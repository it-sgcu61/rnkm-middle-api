var express = require('express');
var config = require("../config");
var redis = require('redis');
var config = require('../config');
var client = redis.createClient(6379, config.redisAddr, { no_ready_check: true });
function esc(str) {
    return (String(str) + '').replace(/[\\"']/g, '\\$&');
}
module.exports = function (DTNLagent) {
    var router = express.Router();
    router.get('/all/:tel/:nationalID', async function (req, res, next) {
        const { tel, nationalID } = req.params;
        var response = {}

        client.hgetall(`info:${tel}`, async (err, reply) => {
            if (reply && reply['dynamic/nationalID_URL'] === nationalID.toString()) {
                console.log('cached', tel);
                response['result'] = reply;
                response['cached'] = true;
                res.send(response);
            }
            else if (reply !== null) {
                console.log('cached', tel);
                response['result'] = '{}';
                res.send(response);
            }
            else {
                console.log('not cached:', tel);
                var possibleData = await DTNLagent.post(`http://${config.dtnlADDR}/api/v1/get/data/${config.rnkmTablename}/1`)
                    .send({
                        sortby: "",
                        orderby: "",
                        filter: `[{\"column_name\":\"dynamic/tel\",\"expression\":\"like\",\"value\":\"^${esc(tel)}$\"},{\"column_name\":\"dynamic/nationalID_URL\",\"expression\":\"like\",\"value\":\"^${esc(nationalID)}$\"}]`,
                    })
                    .withCredentials().catch((err) => { console.log(err); response["result"] = "error"; })
                response["result"] = possibleData.body.body ? possibleData.body.body[0] : "{}"
                var info = possibleData.body.body ? possibleData.body.body[0] : {};
                if (info) {
                    var hash = [];
                    for (var key in info) {
                        hash.push(key);
                        hash.push(info[key]);
                    }
                    client.hmset(`info:${info['dynamic/tel']}`, info);
                    client.expire(`info:${info['dynamic/tel']}`, config.expire);
                }
                response['cached'] = false;
                res.send(response);
            }
        })
    });
    return router
};
