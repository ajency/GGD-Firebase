import { Request, Response } from "express";
import * as admin from 'firebase-admin';
const { AsyncParser, parse } = require('json2csv');
import * as Airtable from 'airtable';
import { extractInstanceAndPath } from "firebase-functions/lib/providers/database";
const { _ } = require("underscore")
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
    "order_type",
    "payment_mode",
    "mrp",
    "sale_price"
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
                pageSize: 5
            }).eachPage(function page(records, fetchNextPage) {
                console.log(records.length);

                records.forEach(async function (record) {
                    let recordFieldKeys = Object.keys(record.fields)
                    const checkDifference = _.difference(EXTERNAL_ORDERS_MANDATORY_FIELDS, recordFieldKeys)
                    if (!checkDifference.length) {
                        const orderObj = record.fields
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
                    }

                });

                fetchNextPage();

            }, async function done(err) {
                if (err) { console.error(err); return; }
                console.log(dataMaster)
                let phoneDir = []
                for (const key in dataMaster) {
                    let phoneNos = _.pluck(dataMaster[key], "phone");
                    phoneNos = _.uniq(phoneNos)
                    phoneDir = _.union(phoneDir, phoneNos)
                }
                console.log(phoneDir)
                for (const productId in productMaster) {
                    try {
                        const prodRef = await db.collection('products').doc(productId).get()
                        if (prodRef.exists) {
                            productMaster[productId] = prodRef.data();
                        }
                    } catch (e) {
                        console.log(e)
                    }
                    admin.auth().createUser({
                        phoneNumber: '+919767992594'
                    })
                        .then(function (userRecord) {
                            // See the UserRecord reference doc for the contents of userRecord.
                            console.log('Successfully created new user:', userRecord.uid);
                        })
                        .catch(function (error) {
                            console.log('Error creating new user:', error);
                        });
                }
                res.status(200).send({ phoneDir })
            });
        } catch (e) {
            res.status(500).send({ message: "Something went wrong" })
        }
    },
    
    checkUserExist: async (phone) => {
        const firestore = admin.firestore(); 
		const userDocs = await firestore.collection('user-details').where('phone', "==", phone).get();
        console.log(userDocs.size,"checkInDb===>");
        const size = userDocs.size
        if(size) {
			let oldUser = false
			for(let i =0; i<size; i++) {
                const userData = userDocs[i].data()
                if(userData.verified) {
                    return true;
                    break;
                } else {

                }
            }
        }
        return true
    },
    createUser:  function(phone) {
        return new Promise(async (resolve,reject) => {
            try {
                const newUser = await admin.auth().createUser({
                    phoneNumber: phone
                })

            } catch (error) {
               console.log(error);
                
            }
        })
       
            .then(function (userRecord) {
                // See the UserRecord reference doc for the contents of userRecord.
                console.log('Successfully created new user:', userRecord.uid);
               return userRecord


            })
            .catch(function (error) {
                console.log('Error creating new user:', error);
                return error
            });
    }

}
export default Admin