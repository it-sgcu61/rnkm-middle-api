var express = require('express');
var router = express.Router();
var redis = require('redis');
var config = require("../config")
var client = redis.createClient(6379, config.redisAddr, {no_ready_check: true});

router.get('/check/:id', function(req, res, next){
  const id = req.params.id;
  var response = {}
  client.sismember('rnkm.student_list', id, function(err, reply){
    if (err){
      response["result"] = "error"
    }
    else{
      response["result"] = reply?"true":"false"
    }
    res.send(response)
  });
});

router.get('/add/:id', function(req, res, next ){
  const id = req.params.id;
  var response = {}
  client.sadd('rnkm.student_list', id, function(err, reply){
    if (err){
      response["result"] = "failed"
    }
    else{
      response["result"] = "success"
    }
    res.send(response)
  });
});

router.get('/del/MDg4OWE4ZWUwODQyY2Y5NmI2MjNhOGIyNmNjNDRkZTlkZDI1ZjI0ZjA1MTBhZjU1NDk5MjVkYzE3Yjc4Y2I4NA==/:id', function(req, res, next ){
  const id = req.params.id;
  var response = {}
  client.srem('rnkm.student_list', id, function(err, reply){
    if (err){
      response["result"] = "failed"
    }
    else{
      response["result"] = "success"
    }
    res.send(response)
  });
});

module.exports = router;
