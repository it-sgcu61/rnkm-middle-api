var express = require('express');
var router = express.Router();
var createError = require('http-errors');
var config = require("../config")
module.exports = function (DTNLagent) {
  var router = express.Router();
  router.get('/', async function(req, res, next){
    var credential = await DTNLagent.get(`http://${config.dtnlADDR}/api/v1/loginStatus`)
    .withCredentials().catch((err)=>{next(createError(500))})
    if(credential.body.username != config.dtnlUser){
      next(createError(500))
    }else{
      res.send({result:"OK"})
    }
  });
  return router
};
