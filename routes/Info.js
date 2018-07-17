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
                                filter: `[{\"column_name\":\"dynamic/tel\",\"expression\":\"like\",\"value\":\"^${esc(tel)}$\"},{\"column_name\":\"dynamic/nationalID_URL\",\"expression\":\"like\",\"value\":\"^${esc(nationalID)}$\"}]`,
                            })
                            .withCredentials().catch((err) => { console.log(err); return { test: "omegalul" } })

                        try {
                            if (data.body.body && data.body.body.length === 1) {
                                var info = data.body.body[0];
                                cache[nationalID] = info;
                                ver[nationalID] = 0;
                                await client.hmsetAsync(`info:${nationalID}`, info);
                                await client.setAsync(`version:${nationalID}`, 0);
                                cache[nationalID].version = ver[nationalID];
                                cache[nationalID].isCached = false;
                                return cache[nationalID];
                            }
                            else {
                                throw new Error(`NOT 1 reply  ${tel}-> ` + data.body.body.length);
                            }
                        }
                        catch (err) {
                            console.log(err);
                            return {};
                        }
                        return 'end';
                    }
                }
            })
            .then(data => {
                res.send(data);
            })
            .catch(err => {
                console.log(err);
                res.send('error');
            })
    });
    router.post('/editInfo', async function (req, res, next) {
        var { tel, nationalID, formData } = req.body;

        try {
            if (cache[nationalID] && cache[nationalID]['dynamic/tel'] === tel) {
                // only SOME Fields are editable
                var editables = ["dynamic/nickname", "dynamic/religion", "dynamic/lineID", "dynamic/facebook",
                    "dynamic/emergency_tel", "dynamic/emergency_tel_relation", "dynamic/RCU_required", "dynamic/RCU_reason",
                    "dynamic/congenital_disease", "dynamic/regularDrug", "dynamic/drugAllergy",
                    "dynamic/disorders", "dynamic/foodAllergies"];
                var validators = [`^`, "^", "^", "^",
                    "0[689][0-9]-[0-9]{3}-[0-9]{4}", "^", "(^yes$)|(^no$)", "^",
                    "^", "^", "^",
                    "^", "^"];

                newCache = cache[nationalID];
                // console.log(newCache)
                formData = JSON.parse(formData);
                for (var idx in validators) {
                    let key = editables[idx], // handle undefined 
                        valid = validators[idx];
                    let value = formData[key] ? formData[key].toString() : 'undefined';
                    if (RegExp(valid).test(value) === true)
                        newCache[key] = value;
                }
                // console.log(cache[nationalID], '->', newCache);
                client.hmset(`info:${nationalID}`, newCache);
                client.incr(`version:${nationalID}`);
                res.send('pass');
            }
            else {
                res.send('error!');
            }
        }
        catch (err) {
            console.log(err);
            res.send('error2');
        }
    });
    return router
}