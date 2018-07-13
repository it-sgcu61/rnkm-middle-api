var express = require('express');
var config = require("../config")
function esc(str){
  return (String(str) + '').replace(/[\\"']/g, '\\$&');
}
module.exports = function (DTNLagent) {
  var router = express.Router();
  router.get('/getHouse/:tel/:nationalID', async function(req, res, next){
    const {tel, nationalID} = req.params;
    var response = {}
    var possibleData = await DTNLagent.post(`http://${config.dtnlADDR}/api/v1/get/data/${config.rnkmTablename}/1`)
    .send({
      sortby:"",
      orderby:"",
      filter:`[{\"column_name\":\"dynamic/tel\",\"expression\":\"like\",\"value\":\"^${esc(tel)}$\"},{\"column_name\":\"dynamic/nationalID\",\"expression\":\"like\",\"value\":\"^${esc(nationalID)}$\"}]`,
    })
    .withCredentials().catch((err)=>{console.log(err);response["result"]="error";})
    response["result"] = possibleData.body.body?possibleData.body.body[0]["final-house"]:"not found"
    res.send(response)
  });
  return router
};
