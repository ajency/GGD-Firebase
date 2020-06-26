import { Request, Response } from "express";
import * as admin from 'firebase-admin';
const { AsyncParser, parse } = require('json2csv');
import * as Airtable from 'airtable';
const cred = require('../../credentials.json');
Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: cred.airtableApiKey
})

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
                            res.setHeader('Content-disposition', 'attachment; filename='+fielname);
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
                pageSize:10
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
                    if(dataMaster[variantData["product_id"]]) {
                        if(dataMaster[variantData["product_id"]].hasOwnProperty("variants")) {
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
                        if(key) {
    
                            const pRef = await db.collection("products").doc(key).get()
                            const pData = pRef.data()
                            let editedv = pData.variants.map((v) => {
                                if(dataMaster[key].variants) {
                                    let variantTOUpdate = dataMaster[key].variants.find((variant) => v.id == variant.id)
                                    if (v.id == variantTOUpdate.id) {
                                        v.active = variantTOUpdate.active
                                    }
                                    return v
                                }
                            })
                            await db.collection("products").doc(key).update({variants:editedv})
    
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
    }
}
export default Admin