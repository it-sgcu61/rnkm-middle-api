var express = require('express');
var config = require("../config")
module.exports = function (DTNLagent) {
  var router = express.Router();
  router.get('/getHouse/:tel/:nationalID', async function(req, res, next){
    const {tel, nationalID} = req.params;
    var possibleData = await DTNLagent.post(`http://${config.dtnlADDR}/api/v1/get/data/${config.rnkmTablename}/1`)
    .send({
      sortby:"",
      orderby:"",
      filter:`[{\"column_name\":\"dynamic/tel\",\"expression\":\"=\",\"value\":\"${tel}\"},{\"column_name\":\"dynamic/nationalID_URL\",\"expression\":\"=\",\"value\":\"${nationalID}\"}]`,
    })
    .withCredentials().catch((err)=>console.log(err))
    res.send(possibleData.body.body[0]["final-house"])
  });
  return router
};
