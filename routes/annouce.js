var express = require('express');
var config = require("../config")
var createError = require('http-errors');
module.exports = function (DTNLagent) {
  var router = express.Router();
  router.get('/getHouse/:tel/:nationalID', async function(req, res, next){
    const {tel, nationalID} = req.params;
    var response = {}
    var possibleData = await DTNLagent.post(`http://${config.dtnlADDR}/api/v1/get/data/${config.rnkmTablename}/1`)
    .send({
      sortby:"",
      orderby:"",
      filter:`[{\"column_name\":\"dynamic/tel\",\"expression\":\"eq\",\"value\":\"${tel}\"},{\"column_name\":\"dynamic/nationalID_URL\",\"expression\":\"eq\",\"value\":\"${nationalID}\"}]`,
    })
    .withCredentials().catch((err)=>{console.log(err);response["result"]="error";})
    response["result"] = possibleData.body.body?possibleData.body.body[0]["final-house"]:"not found"
    res.send(response)
  });
  return router
};
