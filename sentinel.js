var Promise = require('bluebird');
var redis = Promise.promisifyAll(require('redis'));
var config = require('./config')
var client = redis.createClient(6379, config.redisAddr, { no_ready_check: true });
var request = require('superagent');
var sha256 = require('sha256')
const agent = request.agent()
console.log("Initializing...")
function esc(str) {
  return (String(str) + '').replace(/[\\"']/g, '\\$&');
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
console.log("Logging in")
setupDTNL().then((agent)=>{
  console.log("Logged in")
  setInterval(async ()=>{
    console.log(".")
    var nationalID = await client.spopAsync("editList")
    if(nationalID){
      console.log(`Commit ${nationalID} to DTNL system`)
      //prepare syntax
      const newinfo = await client.hgetallAsync(`info:${nationalID}`);
      const updateArray = Object.keys(newinfo).filter((key)=>(newinfo[key])).map((key)=>({"columnName": key, 'value': `'${newinfo[key]}'`}))
      agent.post(`http://${config.dtnlADDR}/api/v1/edit/editSelectData/${config.rnkmTablename}`)
      .send({
        filter: `[{\"column_name\":\"dynamic/nationalID\",\"expression\":\"like\",\"value\":\"^${esc(nationalID)}$\"}]`,
        modify_list:JSON.stringify({ idList: [], modifyList: updateArray })
      })
      .withCredentials().catch((err) => { console.log(err); return { test: "omegalul" } })
      console.log({
        filter: `[{\"column_name\":\"dynamic/nationalID\",\"expression\":\"like\",\"value\":\"^${esc(nationalID)}$\"}]`,
        modify_list:JSON.stringify({ idList: [], modifyList: updateArray })
      })
      client.expire(`info:${nationalID}`, 300);
      client.expire(`version:${nationalID}`, 300);
    }
  },100)
})
