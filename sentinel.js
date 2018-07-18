var Promise = require('bluebird');
var redis = Promise.promisifyAll(require('redis'));
var config = require('./config')
var app = require('./app')
var client = redis.createClient(6379, config.redisAddr, { no_ready_check: true });
function esc(str) {
  return (String(str) + '').replace(/[\\"']/g, '\\$&');
}
app().then((agent)=>{
  setInterval(async ()=>{
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
