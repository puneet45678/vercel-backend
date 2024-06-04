const express = require('express')
const { generateSlug } = require('random-word-slugs')
const { ECSClient, RunTaskCommand, DescribeTasksCommand } = require('@aws-sdk/client-ecs');
const {Server} = require('socket.io')
const redis = require('redis');
const { Redis } = require('ioredis');

const app = express()
const PORT = 9000

app.use(express.json())

// create a new one using AnimationEvent.io
const subscriber = new Redis('')

const io = new Server({cors:'*'})

io.on('connection',socket=>{
    socket.on('subscribe' , channel=>{
        socket.join(channel)
        socket.emit('message' , `Joined ${channel}`)
    })
})
io.listen(9002, () => console.log('Socket Server 9002'))

const ecsClient = new ECSClient({
    region :'',
    credentials:{
        accessKeyId :'',
        secretAccessKey:''
    }
})

const config ={
    CLUSTER : "",
    TASK:""

}
app.post('/project',async (req , res)=>{
    const {giturl} = req.body
    const projectslug = generateSlug()
    const command = new RunTaskCommand({
        cluster:config.CLUSTER,
        taskDefinition:config.TASK,
        launchType: 'FARGATE',
        count:1,
        networkConfiguration:{
            awsvpcConfiguration:{
                assignPublicIp: 'ENABLED',
                subnets:['subnet-0a0217427429de7e0' , 'subnet-0deb2a129b88da0b8' ,'subnet-0d706e182382a5b65'],
                securityGroups:['sg-036d7788e04a860c8']
            }
        },
        overrides:{
            containerOverrides:[
                {
                    name :'builder-image',
                    environment:[
                        {
                            name:'GIT_REPOSITORY__URL' , value :giturl
                        },
                        {
                            name:'PROJECT_ID' , value:projectslug
                        }
                    ]
                }
            ]
        }

    })

    try {
        const response = await ecsClient.send(command);
        console.log("ECS task started successfully:", response);
        res.json({
            status: 'queued',
            data: {
                projectslug,
                url: `http://${projectslug}.localhost:8000`
            }
        });
    } catch (error) {
        console.error("Failed to start ECS task:", error);
        res.status(500).json({ status: 'error', message: 'Failed to start the task' });
    }

})

app.get('/check-status/:taskArn', async (req, res) => {
    const taskArn = req.params.taskArn;
    const status = await checkTaskStatus(taskArn);
    res.json({ status });
});

async function checkTaskStatus(taskArn) {
    const command = new DescribeTasksCommand({
        cluster: "",
        tasks: [taskArn]
    });

    try {
        const response = await ecsClient.send(command);
        if (response.tasks.length === 0) {
            console.log("No task found with the specified ARN.");
            return "No task found";
        }
        const task = response.tasks[0];
        console.log(`Task status: ${task.lastStatus}`);
        return task.lastStatus;
    } catch (error) {
        console.error("Error checking task status:", error);
        return "Error retrieving task status";
    }
}

async function initRedisSubscribe() {
    console.log('Subscribed to logs....')
    subscriber.psubscribe('logs:*')
    subscriber.on('pmessage', (pattern, channel, message) => {
        io.to(channel).emit('message', message)
    })
}


initRedisSubscribe()

app.listen(PORT ,()=> console.log(`API Server Running .. ${PORT}`))