﻿var createError = require('http-errors');
var fs = require('fs');
var express = require('express');
var cookieParser = require('cookie-parser');
var morgan = require('morgan');
var https = require('https');
var request = require('superagent');
var registHandler = require('./routes/registration');
var announceHandler = require('./routes/annouce');
var chkStatusHandler = require('./routes/chkStatus');
var InfoHandler = require('./routes/Info');
var config = require('./config')
var sha256 = require('sha256')
var app = express();
var cors = require('cors')
const Influx = require('influx')
var options = {
  ca: fs.readFileSync('./bundle.crt'),
  key: fs.readFileSync('./server.key'),
  cert: fs.readFileSync('./server.crt')
}

const agent = request.agent()
const logger = new Influx.InfluxDB({
  host: 'datanaliez-api-logdb-influxdb',
  port:8086,
  database: 'MIDDLE-API-LOG',
  username: 'admin',
  password: 'en0n1gm0us',
  schema: [
    {
      measurement: 'LOG',
      fields: {
        ip: Influx.FieldType.STRING,
        status: Influx.FieldType.INTEGER,
        latency: Influx.FieldType.FLOAT,
      },
      tags: ['url','ip','status']
    }
  ]
})

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
      username: config.dtnlUser,
      password: sha256(sha256(config.dtnlPassword) + challenge_request.body.challenge)
    })
    .withCredentials().catch((err) => console.log(err))
  if (login_result.body.permission == -1) {
    throw new Error("Failed to connect to DTNL system.")
  } else {
    var tableFetch = await agent.get(`http://${config.dtnlADDR}/api/v1/get/tableList`).withCredentials()
    if (tableFetch.body.tableList.includes(config.rnkmTablename)) {
      throw new Error("Table configuration invalid.")
    }
    return Promise.resolve(agent)
  }
}
const port = normalizePort(process.env.PORT || '3000');
setupDTNL().then((agent) => {
  app.use(cors())
  // app.use(logger('dev'));
  app.use(morgan(function (tokens, req, res) {
    logger.writePoints([
      {
        measurement: 'LOG',
        tags: { url: tokens.url(req, res), ip : tokens["remote-addr"](req, res), status: tokens.status(req, res)},
        fields: { ip : tokens["remote-addr"](req, res), status: tokens.status(req, res), latency: tokens['response-time'](req, res) },
      }
    ])
  }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use('/api/registration', registHandler);
  app.use('/api/announce', announceHandler(agent));
  app.use('/api/chkStatus', chkStatusHandler(agent));
  app.use('/api/chkInfo', InfoHandler(agent));
  // catch 404 and forward to error handler
  app.use(function (req, res, next) {
    next(createError(404));
  });
  // error handler
  app.use(function (err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.send("<h1 style='margin-bottom:30px'>sorry, but something went wrong. </h1> RNKM Middle-API system <br/> © 2018 Computer Engineering Student, Chulalongkorn University")
  });
  app.set('port', port);
  var server = https.createServer(options, app);
  server.listen(port);
  server.on('error', onError);
}).catch((error) => { throw error; process.exit(1) })
module.exports = setupDTNL
