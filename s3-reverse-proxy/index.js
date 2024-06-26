const express = require('express')
const httpProxy = require('http-proxy')

const proxy =  httpProxy.createProxyServer();
const app = express()
const PORT = 8000

// https://vercelpuneetg.s3.ap-south-1.amazonaws.com/__outputs
const BASE_PATH = ""
app.use((req,res)=>{
    const hostname= req.hostname;
    const subdomain = hostname.split('.')[0];
    const resolvesTo = `${BASE_PATH}/${subdomain}`

    proxy.web(req , res ,{target :resolvesTo , changeOrigin :true})

})

proxy.on('proxyReq' , (proxyReq , req , res)=>{
    const url = req.url;
    if(url=='/'){
        proxyReq.path += 'index.html'
    }

    return proxyReq
})

app.listen(PORT ,()=> console.log(`Reverse Proxy Running .. ${PORT}`))