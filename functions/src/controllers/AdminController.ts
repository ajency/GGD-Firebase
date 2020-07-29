import { Request, Response } from "express";
import * as admin from 'firebase-admin';
const { AsyncParser, parse } = require('json2csv');
import * as Airtable from 'airtable';
import Axios from "axios";
const { _ } = require("underscore")

const cred = require('../../credentials.json');
Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: cred.airtableApiKey
})

const URL = `https://api.airtable.com/v0/${cred.airtableBase}/coupon_rules`
const HEADERS = {
    "Authorization": `Bearer ${cred.airtableApiKey}`
}

const MANDATORY_COUPON_FIELDS = [ 
                    "code",
                    "business_id",
                    "title", 
                    "summary", 
                    "criteria", 
                    "coupon_type", 
                    "discount_type", 
                    "discount_value", 
                    "coupon_category", 
                    "active",
                    "coupon_rules"
                ]
const MANDATORY_RULES_FIELDS = [
    "fact",
    "operator",
    "error_message",
    "value"
]
const Admin = {
    getProductsCSV: async function (req: Request, res: Response) {
        const db = admin.firestore();
        try {
            const business_id = req.query.business_id
            if (!business_id) {
                res.status(500).send({ message: "Please provide business id" });
            }
            const businessRef = await db.collection('businesses').doc(business_id).get()
            if (!businessRef.exists) {
                res.status(500).send({ message: "No business registered with this id, Please contact admin for more information" });
            }
            let businessData = businessRef.data()
            if (!businessData.airtable_config) {
                res.status(500).send({ message: "No config found for airtable, Please contact admin for more information" });
            }
            let ignoreList = []
            let VariantDataStructure = {}
            if (businessData.airtable_config.product_csv_ignore_list) {
                ignoreList = businessData.airtable_config.product_csv_ignore_list
            }
            if (businessData.airtable_config.product_table_datatypes) {
                VariantDataStructure = businessData.airtable_config.product_table_datatypes
            }
            db.collection('products').where("business_id", "==", business_id).get().then((productCol) => {
                console.log(productCol.size);
                const productDocs = productCol.docs
                const productsArrayToConvert = [];
                if (productDocs.length) {
                    const variants = productDocs.map((doc) => {
                        const pdata = doc.data()
                        let product_id = doc.id
                        if (pdata.variants) {

                            return pdata.variants.map((v) => {
                                for (const key in v) {
                                    if (!VariantDataStructure[key]) {
                                        let dataType = typeof v[key]
                                        VariantDataStructure[key] = dataType;
                                    }
                                }
                                if (ignoreList.length) {
                                    ignoreList.forEach(element => {
                                        delete v[element];
                                    });
                                }

                                productsArrayToConvert.push({ product_id: product_id, title: pdata.title, ...v })
                            })
                        }

                    })
                    setTimeout(async () => {
                        console.log(VariantDataStructure);
                        try {

                            businessData["airtable_config"]["product_table_datatypes"] = VariantDataStructure
                            await businessRef.ref.update(businessData)

                        } catch (error) {
                            console.log(error);

                        } finally {
                            const fielname = `Products-${businessData.name}.csv`
                            const csv = parse(productsArrayToConvert);
                            res.setHeader('Content-disposition', 'attachment; filename=' + fielname);
                            res.set('Content-Type', 'text/csv');
                            res.status(200).send(csv);
                        }

                    }, 2000)

                } else {
                    res.status(500).send({ message: `There are no products mapped to provided business id, Please contact admin for more information` })

                }
            }).catch(e => {

                res.status(500).send(e)
            })
        } catch (error) {
            res.status(500).send("")
        }
    },

    fetchDataFromAirtable: async function (req: Request, res: Response) {
        const db = admin.firestore();
        try {
            const business_id = req.query.business_id
            if (!business_id) {
                res.status(500).send({ message: "Please provide business id, Please contact admin for more information" });
            }
            const businessRef = await db.collection('businesses').doc(business_id).get()
            if (!businessRef.exists) {
                res.status(500).send({ message: "No business registered with this id, Please contact admin for more information" });
            }
            let businessData = businessRef.data()
            if (!businessData.airtable_config) {
                res.status(500).send({ message: "No config found for airtable, Please contact admin for more information" });
            }
            let ignoreList = []
            let VariantDataStructure = {}
            if (!businessData.airtable_config.base_id) {
                res.status(500).send({ message: "No config found for airtable, Please contact admin for more information" });
            }
            if (businessData.airtable_config.product_csv_ignore_list) {
                ignoreList = businessData.airtable_config.product_csv_ignore_list
            }
            if (businessData.airtable_config.product_table_datatypes) {
                VariantDataStructure = businessData.airtable_config.product_table_datatypes
            }

            const base_id = businessData.airtable_config.base_id;
            const airtable_name = businessData.airtable_config.products_table;
            const base = Airtable.base(base_id);
            const dataMaster = {}
            base(airtable_name).select({
                // Selecting the first 3 records in Grid view:
                // view: "Grid view"
                pageSize: 10
            }).eachPage(function page(records, fetchNextPage) {
                // This function (`page`) will get called for each page of records.
                records.forEach(async function (record) {

                    // console.log(record.fields)
                    // res.status(200).send(record.fields)
                    let variantData = record.fields
                    for (const key in variantData) {
                        switch (VariantDataStructure[key]) {
                            case "integer":
                                variantData[key] = parseInt(variantData[key])
                                break;

                            case "boolean":
                                if (variantData[key] == "false") {
                                    variantData[key] = false
                                }
                                if (variantData[key] == "true") {
                                    variantData[key] = true
                                }
                                break;
                            default:
                                break;
                        }
                    }
                    // console.log(variantData);
                    if (dataMaster[variantData["product_id"]]) {
                        if (dataMaster[variantData["product_id"]].hasOwnProperty("variants")) {
                            dataMaster[variantData["product_id"]]["variants"].push(variantData)
                        } else {
                            dataMaster[variantData["product_id"]]["variants"] = [];
                            dataMaster[variantData["product_id"]]["variants"].push(variantData)
                        }
                    } else {
                        dataMaster[variantData["product_id"]] = {};
                        dataMaster[variantData["product_id"]]["variants"] = [];
                        dataMaster[variantData["product_id"]]["variants"].push(variantData)
                    }
                    // dataMaster[variantData["product_id"]]["variants"].push(variantData) 

                });

                // To fetch the next page of records, call `fetchNextPage`.
                // If there are more records, `page` will get called again.
                // If there are no more records, `done` will get called.
                fetchNextPage();

            }, async function done(err) {
                if (err) { console.error(err); return; }
                console.log(dataMaster)
                for (const key in dataMaster) {

                    try {
                        if (key) {

                            const pRef = await db.collection("products").doc(key).get()
                            const pData = pRef.data()
                            let editedv = pData.variants.map((v) => {
                                if (dataMaster[key].variants) {
                                    let variantTOUpdate = dataMaster[key].variants.find((variant) => v.id == variant.id)
                                    if (v.id == variantTOUpdate.id) {
                                        v.active = variantTOUpdate.active
                                    }
                                    return v
                                }
                            })
                            await db.collection("products").doc(key).update({ variants: editedv })

                        }
                    } catch (e) {
                        console.log(e)
                    }
                }
                res.status(200).send("All variants has been updated")
            });
        } catch (e) {
            res.status(500).send({ message: "Something went wrong" })
        }
    },

    updateCartsWithUserId: async function (req: Request, res: Response) {
        const db = admin.firestore();
        let resp = await db.collection("carts").get()
        let allDocs = resp.docs
        let cartToUpdate = {}
        allDocs.forEach(async (doc) => {
            let docId = doc.id
            let userId = docId.split("-")[0]
            let docData = doc.data()
            if (!docData.user_id) {
                cartToUpdate[docId] = userId
                console.log(userId)
            }
        });
        for (const key in cartToUpdate) {
            await db.collection("carts").doc(key).update({ user_id: cartToUpdate[key] })
        }
        return res.status(200).send("ok")


    },

    addNewCoupons: async (req: Request, res: Response) => {
        const db = admin.firestore();
        try {
            const business_id = req.query.business_id
            if (!business_id) {
                res.status(500).send({ message: "Please provide business id" });
                return;
            }
            const businessRef = await db.collection('businesses').doc(business_id).get()
            if (!businessRef.exists) {
                res.status(500).send({ message: "No business registered with this id, Please contact admin for more information" });
                return;
            }
            let businessData = businessRef.data()
            if (!businessData.airtable_config) {
                res.status(500).send({ message: "No config found for airtable, Please contact admin for more information" });
                return;
            }
            const couponsToSave = {}
            const responseToUser = []
            const base_id = businessData.airtable_config.base_id;
            const base = Airtable.base(base_id);
            base('coupons').select({
                // Selecting the first 3 records in Grid view:
                // view: "Grid view"
                pageSize: 10
            }).eachPage(function page(records, fetchNextPage) {
                // This function (`page`) will get called for each page of records.
                records.forEach(async function (record, index) {
                    console.log(record.fields)
                    // res.status(200).send(record.fields)
                    let coupons = record.fields
                    const allKey = Object.keys(coupons)
                    console.log(allKey)
                    const checkDifference =  _.difference(MANDATORY_COUPON_FIELDS,allKey)
                    if (!coupons.firebase_id && !checkDifference.length) {
                        coupons.rules = {
                            all: []
                        }
                        coupons.description = {
                            summary: coupons.summary,
                            criteria: coupons.criteria
                        }
                        coupons.success = {
                            code: coupons.success_code || "VALID_COUPON",
                            message: coupons.success_message || "Coupon is valid and can be applied"
                        }
                        coupons.code = coupons.code.toUpperCase()
                        coupons.airtable_id = record.id

                        delete coupons.criteria
                        delete coupons.succes_code
                        delete coupons.success_message
                        delete coupons.summary
                        couponsToSave[index] = coupons
                    } else {
                        if(checkDifference.length)
                            responseToUser.push(`Coupon:${coupons.code} id:${record.id} can not be created some fields are empty `)
                    }
                });



                // To fetch the next page of records, call `fetchNextPage`.
                // If there are more records, `page` will get called again.
                // If there are no more records, `done` will get called.
                fetchNextPage();

            }, async function done(err) {
                if (err) { 
                    console.error(err); 
                    res.status(500).send({})
                    return
                }

                if (Object.keys(couponsToSave).length) {
                    for (const key in couponsToSave) {
                        if (couponsToSave.hasOwnProperty(key)) {


                            try {
                                if (couponsToSave[key].coupon_rules) {
                                    const rules = couponsToSave[key].coupon_rules
                                    for(const rulekey in rules) {
                                        if(rules[rulekey]) {
                                            console.log(rules[rulekey])
                                            let resp:any = await Axios.get(URL + '/' + rules[rulekey], { headers: HEADERS })
                                            const rulesFields = Object.keys(resp.data.fields)
                                            const checkDifference =  _.difference(MANDATORY_RULES_FIELDS,rulesFields)
                                            if (!checkDifference.length) {
                                                let ruleObj = {
                                                    error: {
                                                        message:resp.data.fields.error_message
                                                    },
                                                    fact:resp.data.fields.fact,
                                                    operator: resp.data.fields.operator,
                                                    value: resp.data.fields.value
                                                }
                                                switch (resp.data.fields.operator) {
                                                    case "in":
                                                    case "notIn":
                                                        ruleObj.value = resp.data.fields.value.split(',')
                                                    break;

                                                     default: 
                                                     break;
                                                }
                                               
                                                couponsToSave[key].rules.all.push(ruleObj)
                                            } else {
                                                responseToUser.push(`Coupon:${couponsToSave[key].code} can not be created some rules fields are empty `);
                                                break;
                                            }
                                        }
                                    }
                                }
                                console.log(couponsToSave[key]);
                                delete couponsToSave[key].coupon_rules
                                await db.collection('coupons').doc().set(couponsToSave[key])
                                responseToUser.push(`Coupon ${couponsToSave[key].code} created`)
                            } catch (error) {
                                console.log(error)

                            }
                        }

                    }
                    res.status(200).send(responseToUser)
                    return;

                } else {
                    res.status(200).send(responseToUser)
                return;
                    
                }
            });

        } catch (error) {

            res.status(200).send({})
            return;
        }
    },

    updateCoupons: async (req: Request, res: Response) => {
        const db = admin.firestore();
        try {
            const business_id = req.query.business_id
            if (!business_id) {
                res.status(500).send({ message: "Please provide business id" });
                return;
            }
            const businessRef = await db.collection('businesses').doc(business_id).get()
            if (!businessRef.exists) {
                res.status(500).send({ message: "No business registered with this id, Please contact admin for more information" });
                return;
            }
            let businessData = businessRef.data()
            if (!businessData.airtable_config) {
                res.status(500).send({ message: "No config found for airtable, Please contact admin for more information" });
                return;
            }
            const couponsToSave = {}
            const responseToUser = []
            const base_id = businessData.airtable_config.base_id;
            const base = Airtable.base(base_id);
            base('coupons').select({
                // Selecting the first 3 records in Grid view:
                // view: "Grid view"
                pageSize: 10
            }).eachPage(function page(records, fetchNextPage) {
                // This function (`page`) will get called for each page of records.
                records.forEach(async function (record) {
                    // res.status(200).send(record.fields)
                    let coupons = record.fields
                    const allKey = Object.keys(coupons)
                    console.log(allKey)
                    const checkDifference =  _.difference(MANDATORY_COUPON_FIELDS,allKey)
                    if (coupons.firebase_id && !checkDifference.length) {
                        coupons.rules = {
                            all: []
                        }
                        coupons.description = {
                            summary: coupons.summary,
                            criteria: coupons.criteria
                        }
                        coupons.success = {
                            code: coupons.success_code || "VALID_COUPON",
                            message: coupons.success_message || "Coupon is valid and can be applied"
                        }
                        coupons.code = coupons.code.toUpperCase()
                        coupons.airtable_id = record.id
                        delete coupons.criteria
                        delete coupons.succes_code
                        delete coupons.success_message
                        delete coupons.summary
                        couponsToSave[coupons.firebase_id] = coupons
                        delete coupons.firebase_id
                    } else {
                        if(checkDifference.length)
                            responseToUser.push(`Coupon:${coupons.code} id:${record.id} can not be updated fields are empty`)
                    }
                });



                // To fetch the next page of records, call `fetchNextPage`.
                // If there are more records, `page` will get called again.
                // If there are no more records, `done` will get called.
                fetchNextPage();

            }, async function done(err) {
                if (err) { 
                    console.error(err); 
                    res.status(500).send({})
                }

                if (Object.keys(couponsToSave).length) {
                    for (const key in couponsToSave) {
                        if (couponsToSave.hasOwnProperty(key)) {


                            try {
                                if (couponsToSave[key].coupon_rules) {
                                    const rules = couponsToSave[key].coupon_rules
                                    for(const rulekey in rules) {
                                        if(rules[rulekey]) {
                                            console.log(rules[rulekey])
                                            let resp:any = await Axios.get(URL + '/' + rules[rulekey], { headers: HEADERS })
                                            const rulesFields = Object.keys(resp.data.fields)
                                            const checkDifference =  _.difference(MANDATORY_RULES_FIELDS,rulesFields)
                                            if (!checkDifference.length) {
                                                let ruleObj = {
                                                    error: {
                                                        message:resp.data.fields.error_message
                                                    },
                                                    fact:resp.data.fields.fact,
                                                    operator: resp.data.fields.operator,
                                                    value: resp.data.fields.value
                                                }
                                                switch (resp.data.fields.operator) {
                                                    case "in":
                                                    case "notIn":
                                                        ruleObj.value = resp.data.fields.value.split(',')
                                                    break;

                                                     default: 
                                                     break;
                                                }
                                               
                                                couponsToSave[key].rules.all.push(ruleObj)
                                            }  else {
                                                responseToUser.push(`Coupon:${couponsToSave[key].code} can not be update some rules fields are empty `);
                                                res.status(200).send(responseToUser)
                                                return;
                                                break;

                                            }
                                        }
                                    }
                                }
                                console.log(couponsToSave[key]);
                                delete couponsToSave[key].coupon_rules
                                await db.collection('coupons').doc(key).set(couponsToSave[key])
                                responseToUser.push(`Coupon ${couponsToSave[key].code} updated`)
                            } catch (error) {
                                console.log(error)

                            }
                        }

                    }
                    res.status(200).send(responseToUser)
                    return;

                } else {
                    res.status(200).send(responseToUser)
                return;
                    
                }
            });

        } catch (error) {

            res.status(200).send({})
            return;
        }
    }
}
export default Admin