var express = require('express');
var config = require("../config");
var Promise = require('bluebird');
var redis = Promise.promisifyAll(require('redis'));
var config = require('../config');
var client = redis.createClient(6379, config.redisAddr, { no_ready_check: true });
function esc(str) {
    return (String(str) + '').replace(/[\\"']/g, '\\$&');
}


var cache = new Object(),
    ver = new Object();

module.exports = function (DTNLagent) {
    var router = express.Router();
    router.post('/getInfo', async function (req, res, next) {
        const { tel, nationalID } = req.body;
        var response = {}
        console.log(req.body)
        client.getAsync(`version:${nationalID}`)
            .then(value => { // return whether we should return data immediately
                if (value && parseInt(value) === ver[nationalID] && tel === cache['dynamic/tel'])
                    return true;
                return false;
            })
            .then(async (success) => {
                if (success) {
                    cache[nationalID].version = ver[nationalID];
                    cache[nationalID].isCached = true;
                    return cache[nationalID];
                }
                else {
                    var reply = await client.hgetallAsync(`info:${nationalID}`);
                    var version = await client.getAsync(`version:${nationalID}`);

                    if (reply && reply['dynamic/tel'] === tel.toString()) {
                        console.log('cached', tel, 'successful login');
                        cache[nationalID] = reply;
                        ver[nationalID] = parseInt(version);

                        cache[nationalID].version = ver[nationalID];
                        cache[nationalID].isCached = true;
                        return cache[nationalID];
                    }
                    // else if (reply) {
                    //     console.log('reply', reply);
                    //     console.log('cached', tel, 'unsuccessful login');
                    //     return {};
                    // }
                    else {
                        // return "OMEGALUL";
                        console.log('not cached:', tel);

                        var data = await DTNLagent.post(`http://${config.dtnlADDR}/api/v1/get/data/${config.rnkmTablename}/1`)
                            .send({
                                sortby: "",
                                orderby: "",
                                filter: `[{\"column_name\":\"dynamic/nationalID\",\"expression\":\"like\",\"value\":\"^${esc(nationalID)}$\"}]`,
                            })
                            .withCredentials().catch((err) => {res.status(500)})

                        try {
                            if (data.body.body && data.body.body.length === 1) {
                                if(data.body.body[0]["dynamic/tel"] === tel){
                                    var info = data.body.body[0];
                                    cache[nationalID] = info;
                                    ver[nationalID] = 0;
                                    await client.hmsetAsync(`info:${nationalID}`, info);
                                    await client.setAsync(`version:${nationalID}`, 0);
                                    client.expire(`info:${nationalID}`, 1200);
                                    client.expire(`version:${nationalID}`, 1200);
                                    cache[nationalID].version = ver[nationalID];
                                    cache[nationalID].isCached = false;
                                    return cache[nationalID];
                                }else{
                                    return {result:"IncorrectTel"}
                                }
                            }
                            else {
                                throw new Error(`NOT 1 reply  ${tel}-> ` + data.body.body.length);
                            }
                        }
                        catch (err) {
                            console.log(err);
                            return {result:"notFound"};
                        }
                    }
                }
            })
            .then(data => {
                res.send(data);
            })
            .catch(err => {
                res.status(500)
                res.send({result:"error at line 96."})
            })
    });
    router.post('/editInfo', async function (req, res, next) {
        var { tel, nationalID, formData } = req.body;

        try {
            var userdata = cache[nationalID]
            if (!userdata){
                userdata = await client.hgetallAsync(`info:${nationalID}`)
                cache[nationalID] = userdata;
                ver[nationalID] = parseInt(await client.getAsync(`version:${nationalID}`));
            }
            if (userdata && userdata['dynamic/tel'] === tel) {
                // only SOME Fields are editable
                var editables = ["hidden/imageURL", "dynamic/nameprefix", "dynamic/fullname", "dynamic/nickname",
                    "dynamic/emergency_tel","dynamic/faculty", "dynamic/RCU_required", "dynamic/lineID", "dynamic/facebook",
                    "dynamic/emergency_tel_relation", "dynamic/religion", "dynamic/RCU_reason",
                    "dynamic/congenital_disease", "dynamic/regularDrug", "dynamic/drugAllergy",
                    "dynamic/disorders", "dynamic/foodAllergies",];
                var validators = [`^`, "^", "^", "^",
                    "0[689][0-9]-[0-9]{3}-[0-9]{4}", "^", "(^yes$)|(^no$)", "^",
                    "^", "^", "^",
                    "^", "^","^", "^", "^", "^"];

                var newCache = userdata;
                // console.log(newCache)
                formData = JSON.parse(formData);
                for (var idx in validators) {
                    let key = editables[idx], // handle undefined
                        valid = validators[idx];
                    let value = formData[key] ? formData[key].toString() : undefined;
                    if (value && RegExp(valid).test(value) === true)
                        newCache[key] = value;
                }
                delete newCache["isCached"]
                delete newCache["version"]
                client.hmset(`info:${nationalID}`, newCache);
                client.incr(`version:${nationalID}`);
                client.persist(`info:${nationalID}`);
                client.persist(`version:${nationalID}`);
                client.sadd("editList", nationalID)
                res.send({result:"OK"});
            }
            else {
                res.send({result:"permission denied"});
            }
        }
        catch (err) {
            res.status(500)
            res.send({result:"an error occurred."});
        }
    });
    return router
}
