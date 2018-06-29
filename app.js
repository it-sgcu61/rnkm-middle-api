var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var http = require('http');
var debug = require('debug')('test-redis:server');
var request = require('superagent');
var registHandler = require('./routes/registration');
var announceHandler = require('./routes/annouce');
var config = require('./config')
var sha256 = require('sha256')
var app = express();

const agent = request.agent()

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      console.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

async function setupDTNL() {
  var challenge_request = await agent.get(`http://${config.dtnlADDR}/api/v1/greeting`).withCredentials()
  var login_result = await agent.post(`http://${config.dtnlADDR}/api/v1/login`)
  .send({
    username:config.dtnlUser,
    password: sha256(sha256(config.dtnlPassword)+challenge_request.body.challenge)})
  .withCredentials().catch((err)=>console.log(err))
  if(login_result.body.permission == -1){
    throw new Error("Failed to connect to DTNL system.")
  }else{
    var tableFetch = await agent.get(`http://${config.dtnlADDR}/api/v1/get/tableList`).withCredentials()
    if(tableFetch.body.tableList.includes(config.rnkmTablename)) {
      throw new Error("Table configuration invalid.")
    }
    return Promise.resolve(agent)
  }
}
const port = normalizePort(process.env.PORT || '3000');
setupDTNL().then((agent)=>{
  app.use(logger('dev'));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use('/api/registration', registHandler);
  app.use('/api/announce', announceHandler(agent));
  // catch 404 and forward to error handler
  app.use(function(req, res, next) {
    next(createError(404));
  });
  // error handler
  app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.send("<h1 style='margin-bottom:30px'>sorry, but something went wrong. </h1> RNKM Middle-API system <br/> © 2018 Computer Engineering Student, Chulalongkorn University")
  });
  app.set('port', port);
  var server = http.createServer(app);
  server.listen(port);
  server.on('error', onError);
})
.catch((error)=>{throw error; process.exit(1)})
