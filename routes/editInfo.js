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
    router.post('/', async function (req, res, next) {
        var tel = req.body.tel;
        var nationalID = req.body.nationalID;
        var formData = req.body.formData;


        f = JSON.parse(formData);
        var editables = ["dynamic/nickname", "dynamic/religion", "dynamic/lineID", "dynamic/facebook",
            "dynamic/emergency_tel", "dynamic/emergency_tel_relation", "dynamic/RCU_required", "dynamic/RCU_reason",
            "dynamic/congenital_disease", "dynamic/regularDrug", "dynamic/drugAllergy",
            "dynamic/disorders", "dynamic/foodAllergies"];
        var validators = [`^`, "^", "^", "^",
            "0[689][0-9]-[0-9]{3}-[0-9]{4}", "^", "(^yes$)|(^no$)", "^",
            "^", "^", "^",
            "^", "^"];
        var toEdit = [];
        for (var idx in editables) {
            let key = editables[idx];
            let val = validators[idx];
            if (f[key] && RegExp(val).test(key) === true)
                toEdit.push({ "column_name": key, 'value': `"${esc(f[key])}"` })
            else if (f[key] && !RegExp(val).test(key) === true)
                console.log(`invalid data for ${key}: ${f[key]} expected /${validators[idx]}/`)
        }


        client.hgetall(`info:${tel}`, async (err, reply) => {
            if (!err && reply && reply['dynamic/nationalID_URL'] === nationalID.toString()) {
                console.log('cached', tel, true);
                console.log('toEdit', toEdit)
                console.log('toSend', {
                    modify_list: JSON.stringify({ idList: [reply['_id']], modifyList: toEdit })
                })
                if (reply['_id'] && toEdit.length !== 0)
                    return DTNLagent.post(`http://${config.dtnlADDR}/api/v1/edit/editCheckedData/${config.rnkmTablename}`)
                        .send({
                            modify_list: JSON.stringify({ idList: [reply['_id']], modifyList: toEdit })
                        })
                        .withCredentials()
                        .then(() => {
                            res.send('true');
                        })
                        .catch((err) => { console.log(err); res.send('error') }) // OK
                else
                    res.send('error');

            }
            else if (!err && reply) {
                console.log('cached', tel, false);

                // response['result'] = '{}';
                res.send('false');
            }
            else {
                console.log('not cached:', tel);
                var possibleData = await DTNLagent.post(`http://${config.dtnlADDR}/api/v1/get/data/${config.rnkmTablename}/1`)
                    .send({
                        sortby: "",
                        orderby: "",
                        filter: `[{\"column_name\":\"dynamic/tel\",\"expression\":\"like\",\"value\":\"^${esc(tel)}$\"},{\"column_name\":\"dynamic/nationalID_URL\",\"expression\":\"like\",\"value\":\"^${esc(nationalID)}$\"}]`,
                    })
                    .withCredentials().catch((err) => { console.log(err); res.send('error') })

                var info = possibleData.body.body ? possibleData.body.body[0] : {};
                try {
                    console.log(info);
                    if (info && JSON.stringify(info) !== '{}') {
                        client.hmset(`info:${info['dynamic/tel']}`, info);
                        client.expire(`info:${info['dynamic/tel']}`, 3600);

                        if (info._id && toEdit.length !== 0)
                            agent.post(`http://${config.dtnlADDR}/api/v1/edit/editCheckedData/${config.rnkmTablename}`)
                                .send({
                                    modify_list: JSON.stringify({ idList: [info._id], modifyList: toEdit })
                                })
                                .withCredentials()
                                .then(() => {
                                    return res.send('true');
                                })
                                .catch((err) => { console.log(err); return res.send('error') }) // OK
                        else
                            res.send('error');
                    }
                    else {
                        res.send('false');
                    }
                }
                catch (err) {
                    res.send('false')
                }
            }
        })
    });
    return router
};
