import { Request, Response } from "express";
import * as admin from 'firebase-admin';
const { AsyncParser, parse } = require('json2csv');
import * as Airtable from 'airtable';
import e = require("express");
import Order from "./OrderController";
import PaymentGateway from "./PaymentController";
const { _ } = require("underscore")
import Axios from "axios";

const cred = require('../../credentials.json');
Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: cred.airtableApiKey
})
const EXTERNAL_ORDERS_MANDATORY_FIELDS = [
    "order_id",
    "phone",
    "variant_id",
    "product_id",
    "order_date",
    "external_order_type",
    "payment_mode",
    "mrp",
    "sale_price",
    "quantity",
    "name",
    "email",
]

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
                                let tags = "";
                                let group_name ="";
                                if(pdata.tags)
                                    tags = pdata.tags.toString();
                                
                                if(pdata.group_name)
                                    group_name = pdata.group_name.trim();
                                productsArrayToConvert.push({ product_id: product_id, title: pdata.title, ...v, tags, group_name })
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
            }).catch(error => {

                res.status(500).send({ error })
            })
        } catch (error) {
            res.status(500).send({ error })
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
                pageSize: 100
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
    createOrders: async function (req: Request, res: Response) {
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

            const base_id = businessData.airtable_config.base_id;
            const base = Airtable.base(base_id);
            const dataMaster = {}
            const productMaster = {}
            base("external_orders").select({
                view: "Orders To Upload",
                filterByFormula: 'AND(processed = FALSE())',
                maxRecords: 100
            }).eachPage(function page(records, fetchNextPage) {
                console.log(records.length);

                records.forEach(async function (record) {
                    let recordFieldKeys = Object.keys(record.fields)
                    const checkDifference = _.difference(EXTERNAL_ORDERS_MANDATORY_FIELDS, recordFieldKeys)

                    if (!checkDifference.length) {
                        const orderObj = record.fields
                        orderObj.airtableId = record.id
                        if (dataMaster[orderObj.order_id]) {
                            dataMaster[orderObj.order_id].push(orderObj)
                        } else {
                            dataMaster[orderObj.order_id] = []
                            dataMaster[orderObj.order_id].push(orderObj)
                        }
                        if (productMaster[orderObj.product_id]) {
                            productMaster[orderObj.product_id].push({ variant_id: orderObj.variant_id })
                        } else {
                            productMaster[orderObj.product_id] = []
                            productMaster[orderObj.product_id].push({ variant_id: orderObj.variant_id })
                        }
                    } else {
                        console.log("validation fale");

                    }

                });

                fetchNextPage();

            }, async function done(err) {
                if (err) { console.error(err); return res.status(500).send({ err }) }
                for (const productId in productMaster) {
                    console.log(productId);

                    try {
                        const prodRef = await db.collection('products').doc(productId).get()
                        if (prodRef.exists) {
                            productMaster[productId] = prodRef.data();
                        }
                    } catch (e) {
                        console.log(e)
                    }
                }
                //build order object

                const ordermaster = []
                console.log(Object.keys(dataMaster).length);
                const userStore = {}
                for (let ex_order_id in dataMaster) {
                    console.log("processing order", ex_order_id);

                    let name, email = ""
                    let orderObj = {
                        airtableIds: [],
                        airtableUpdated: false,
                        userNotified: true,
                        externalOrderType: "",
                        externalOrderId: "",
                        business_id: business_id,
                        cart_count: 0,
                        order_id: "",
                        items: [],
                        shipping_address: {
                            landmark: "Flat number, Building name not entered as part of the order.",
                            formatted_address: "Google location not entered as part of the order",
                            lat_long: [15.4873766, 73.83266669999999],
                            phone: "",
                            name: "",
                            email: ""

                        },
                        order_mode: "manual",
                        order_no: "",
                        payment_id: "",
                        status: "placed",
                        stock_location_id: "",
                        summary: {
                            cart_discount: 0,
                            mrp_total: 0,
                            sale_price_total: 0,
                            shipping_fee: 0,
                            you_pay: 0
                        },
                        timestamp: new Date(),
                        token: 0,
                        user_id: ""
                    }
                    const paymentObj = {
                        order_id: "",
                        other_details: "",
                        status: "captured",
                        timestamp: new Date(),
                        user_id: ""
                    }
                    try {
                        // build items
                        let firebase_order_id = ""
                        let phone_number = ""
                        if (!phone_number) {
                            let phoneNos = _.pluck(dataMaster[ex_order_id], "phone");
                            phoneNos = _.uniq(phoneNos)

                            phone_number = phoneNos[0].replace("+91", "");
                        }
                        orderObj.shipping_address.phone = phone_number;
                        let mrp_total = 0, sale_price_total = 0, cart_discount = 0, delivery_fee = 0;

                        for (const index in dataMaster[ex_order_id]) {
                            orderObj.cart_count = orderObj.cart_count + (dataMaster[ex_order_id][index].quantity * 1)
                            orderObj.airtableIds.push(dataMaster[ex_order_id][index].airtableId)
                            mrp_total = mrp_total + (dataMaster[ex_order_id][index].mrp * dataMaster[ex_order_id][index].quantity);
                            sale_price_total = sale_price_total + (dataMaster[ex_order_id][index].sale_price * dataMaster[ex_order_id][index].quantity);
                            if (!firebase_order_id) {
                                firebase_order_id = dataMaster[ex_order_id][index].external_order_type + '_' + dataMaster[ex_order_id][index].order_id;
                                orderObj.order_id = paymentObj.order_id = firebase_order_id
                                orderObj.payment_id = "payment_" + dataMaster[ex_order_id][index].external_order_type + '_' + dataMaster[ex_order_id][index].order_id
                                orderObj.externalOrderId = dataMaster[ex_order_id][index].order_id
                                orderObj.externalOrderType = dataMaster[ex_order_id][index].external_order_type
                            }
                            if (!orderObj.timestamp) {
                                orderObj.timestamp = paymentObj.timestamp = new Date(dataMaster[ex_order_id][index].order_date)
                            }

                            if (!paymentObj.other_details) {
                                const paymentMode = dataMaster[ex_order_id][index].payment_mode
                                paymentObj.other_details = `{"method":"${paymentMode.toLowerCase()}"}`
                            }

                            if (!name) {
                                name = dataMaster[ex_order_id][index].name
                            }

                            if (!email) {
                                email = dataMaster[ex_order_id][index].email
                            }

                            const product = productMaster[dataMaster[ex_order_id][index].product_id]

                            const variant = product.variants.find((v => v.id == dataMaster[ex_order_id][index].variant_id))
                            const item = {
                                day: variant.day,
                                description: product.description,
                                mrp: dataMaster[ex_order_id][index].mrp,
                                product_id: dataMaster[ex_order_id][index].product_id,
                                product_name: product.title,
                                quantity: dataMaster[ex_order_id][index].quantity,
                                sale_price: dataMaster[ex_order_id][index].sale_price,
                                size: variant.size,
                                slot: variant.slot,
                                timestamp: dataMaster[ex_order_id][index].order_date,
                                variant_id: variant.id,
                                veg: product.veg

                            }
                            orderObj.items.push(item)
                        }
                        orderObj.summary.mrp_total = mrp_total
                        orderObj.summary.sale_price_total = sale_price_total
                        orderObj.summary.you_pay = (sale_price_total - cart_discount) + delivery_fee;
                        let userObj: any = {}
                        if (userStore[phone_number]) {
                            userObj = userStore[phone_number]
                        } else {
                            const newPhone = "+91" + phone_number
                            const payload = { phone: newPhone, name, email }
                            userObj = await Admin.getUser(payload)
                            userStore[phone_number] = userObj
                        }
                        orderObj.shipping_address.name = userObj.name || ""
                        orderObj.shipping_address.email = userObj.email || ""
                        orderObj.user_id = userObj.id

                        orderObj.order_no = Order.getOrderNos(orderObj.payment_id, 0) //return order no
                        orderObj = PaymentGateway.getOrdersObj(orderObj);
                        // create Payment object
                        paymentObj.user_id = userObj.id
                    } catch (error) {
                        console.log(error);
                        return res.status(500).send({ error })
                    }
                    Admin.saveOrdersUnderUser(orderObj, paymentObj, userStore[orderObj.shipping_address.phone])
                    ordermaster.push(orderObj)
                }

                return res.status(200).send({ message: "Upload is in progress please check airtable." })
            });
        } catch (e) {
            res.status(500).send({ message: "Something went wrong" })
        }
    },

    getUser: (payload) => {
        console.log("checkInDb===>");
        return new Promise(async (resolve, reject) => {

            const firestore = admin.firestore();
            const userDocs = await firestore.collection('user-details').where('phone', "==", payload.phone.replace("+91", "")).get();
            const size = userDocs.size

            if (size) {
                let userObj: any = false
                for (let i = 0; i < size; i++) {
                    const userData = userDocs.docs[i].data()

                    if (userData.verified) {
                        userObj = { id: userDocs.docs[i].id, ...userData }
                        break;
                    }
                }
                if (userObj) {
                    resolve(userObj)
                } else {
                    resolve({ id: userDocs.docs[0].id, ...userDocs.docs[0].data() })
                }
            } else {
                try {

                    let newUser = await Admin.createVerifiedUser(payload)
                    resolve(newUser)
                } catch (error) {
                    reject(false)
                }
            }
        })
    },
    createVerifiedUser: function (payload) {
        console.log("create user", payload.phone);

        return new Promise(async (resolve, reject) => {
            try {
                const newUser = await admin.auth().createUser({
                    phoneNumber: payload.phone
                })

                await admin.firestore().collection("user-details").doc(newUser.uid).set({
                    verified: true,
                    ...payload,
                    phone: payload.phone.replace("+91", "")
                })
                resolve({
                    id: newUser.uid,
                    verified: true,
                    ...payload,
                    phone: payload.phone.replace("+91", "")
                })
            } catch (error) {
                console.log(error);
                reject(false)
            }
        })
    },
    saveOrdersUnderUser: (orderObj: any, paymentObj: any, userObj) => {
        console.log(`saving ${orderObj.order_id} for user ${userObj.phone}`, orderObj);

        admin.firestore().collection('user-details').doc(userObj.id)
            .collection('orders')
            .doc(orderObj.order_id)
            .create(orderObj).then(res => {
                admin.firestore().collection('payments').doc(orderObj.payment_id).set(paymentObj).then((result) => {
                    console.log("added payment");
                }).catch(error => {
                    console.log(error);
                })
                admin.firestore().collection('user-orders-map').doc().set({ user_id: userObj.id, order_id: orderObj.order_id }).then((result) => {
                    console.log("added payment");
                }).catch(error => {
                    console.log(error);
                })
            }).catch(error => {
                console.log("order already exists");

            })
        return true
    },
    contains: function (target, pattern) {
        var value = 0;
        pattern.forEach(function (word) {
            value = value + target.includes(word);
        });
        return (value === 1)
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
                view: "Create or Update Coupons",
                pageSize: 10
            }).eachPage(function page(records, fetchNextPage) {
                // This function (`page`) will get called for each page of records.
                records.forEach(async function (record, index) {
                    console.log(record.fields)
                    // res.status(200).send(record.fields)
                    let coupons = record.fields
                    const allKey = Object.keys(coupons)
                    console.log(allKey)
                    const checkDifference = _.difference(MANDATORY_COUPON_FIELDS, allKey)
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
                        if (checkDifference.length)
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
                                    for (const rulekey in rules) {
                                        if (rules[rulekey]) {
                                            console.log(rules[rulekey])
                                            let resp: any = await Axios.get(URL + '/' + rules[rulekey], { headers: HEADERS })
                                            const rulesFields = Object.keys(resp.data.fields)
                                            const checkDifference = _.difference(MANDATORY_RULES_FIELDS, rulesFields)
                                            if (!checkDifference.length) {
                                                let ruleObj = {
                                                    error: {
                                                        message: resp.data.fields.error_message
                                                    },
                                                    fact: resp.data.fields.fact,
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

                                                switch (resp.data.fields.fact) {
                                                    case "VALID_FROM":
                                                    case "VALID_TO":
                                                        ruleObj.value = new Date(resp.data.fields.value).getTime()
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
                                let facts = _.pluck(couponsToSave[key].rules.all, "fact")
                                if (!facts.includes("COUPON_INACTIVE")) {
                                    let ruleObj = {
                                        error: {
                                            message: "Coupon is no longer active."
                                        },
                                        fact: "COUPON_INACTIVE",
                                        operator: "equal",
                                        value: "true"
                                    }
                                    couponsToSave[key].rules.all.push(ruleObj)
                                }
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
                view: "Create or Update Coupons",
                pageSize: 10
            }).eachPage(function page(records, fetchNextPage) {
                // This function (`page`) will get called for each page of records.
                records.forEach(async function (record) {
                    // res.status(200).send(record.fields)
                    let coupons = record.fields
                    const allKey = Object.keys(coupons)
                    const checkDifference = _.difference(MANDATORY_COUPON_FIELDS, allKey)
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
                        if (checkDifference.length)
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
                                    for (const rulekey in rules) {
                                        if (rules[rulekey]) {
                                            let resp: any = await Axios.get(URL + '/' + rules[rulekey], { headers: HEADERS })
                                            const rulesFields = Object.keys(resp.data.fields)
                                            const checkDifference = _.difference(MANDATORY_RULES_FIELDS, rulesFields)
                                            if (!checkDifference.length) {
                                                let ruleObj = {
                                                    error: {
                                                        message: resp.data.fields.error_message
                                                    },
                                                    fact: resp.data.fields.fact,
                                                    operator: resp.data.fields.operator,
                                                    value: resp.data.fields.value
                                                }
                                                console.log(resp.data.fields.operator);

                                                switch (resp.data.fields.operator) {

                                                    case "in":
                                                    case "notIn":
                                                        ruleObj.value = resp.data.fields.value.split(',')
                                                        break;

                                                    default:
                                                        break;
                                                }

                                                switch (resp.data.fields.fact) {
                                                    case "VALID_FROM":
                                                    case "VALID_TO":
                                                        ruleObj.value = new Date(resp.data.fields.value).getTime()
                                                        break;


                                                    default:
                                                        break;
                                                }
                                                couponsToSave[key].rules.all.push(ruleObj)
                                            } else {
                                                responseToUser.push(`Coupon:${couponsToSave[key].code} can not be update some rules fields are empty `);
                                                res.status(200).send(responseToUser)
                                                return;
                                                break;

                                            }
                                        }
                                    }
                                }
                                delete couponsToSave[key].coupon_rules
                                let facts = _.pluck(couponsToSave[key].rules.all, "fact")
                                console.log(facts);

                                if (!facts.includes("COUPON_INACTIVE")) {
                                    let ruleObj = {
                                        error: {
                                            message: "Coupon is no longer active."
                                        },
                                        fact: "COUPON_INACTIVE",
                                        operator: "equal",
                                        value: "true"
                                    }
                                    couponsToSave[key].rules.all.push(ruleObj)
                                }
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
