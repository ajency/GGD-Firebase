import { Request, Response } from "express";
import * as admin from 'firebase-admin';
const { AsyncParser, parse } = require('json2csv');


const Admin = {
    getProductsCSV: async function (req: Request, res: Response) {
        const db = admin.firestore();
        const ignoreList = ["stock_locations"]
        try {
            const business_id = req.query.business_id
            if (!business_id) {
                res.status(500).send({ message: "Please provide business id" });
            }
            const businessRef = await db.collection('businesses').doc(business_id).get()
            if (!businessRef.exists) {
                res.status(500).send({ message: "No business registered with this id" });
            }
            let businessData = businessRef.data()
            if (!businessData.airtable_config) {
                res.status(500).send({ message: "No config found for airtable" });
            }
            let ignoreList = []
            let VariantDataStructure = {}
            if (businessData.airtable_config.product_ignore_list) {
                ignoreList = businessData.airtable_config.product_ignore_list
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
                            const csv = parse(productsArrayToConvert);
                            res.setHeader('Content-disposition', 'attachment; filename=Products.csv');
                            res.set('Content-Type', 'text/csv');
                            res.status(200).send(csv);
                        }

                    }, 2000)

                } else {
                    res.status(500).send({ message: `There are no products mapped to provided business id` })

                }
            }).catch(e => {

                res.status(500).send(e)
            })
        } catch (error) {
            res.status(500).send("")
        }
    },

    fetchDataFromAirtable: async function (req: Request, res: Response) {
        con
    }
}
export default Admin