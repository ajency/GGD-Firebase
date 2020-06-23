import { Request, Response } from "express";
import * as admin from 'firebase-admin';
const { AsyncParser, parse } = require('json2csv');

// handle any number of columns
// handle for different organisation

const Admin = {
    getProductsCSV: async function (req: Request, res: Response) {
        const db = admin.firestore();
        const ignoreList = ["stock_locations"]
        // try {
            console.log("productCol.size");

           db.collection('products').get().then((productCol) => {
                console.log(productCol.size);
                const productDocs = productCol.docs
                const productsArrayToConvert = [];
                if(productDocs.length) {
                    const variants = productDocs.map( (doc) => {
                        const pdata = doc.data()
                        let product_id = doc.id
                        if(pdata.variants) {

                            return pdata.variants.map((v) => {
                                if(ignoreList.length) {
                                    ignoreList.forEach(element => {
                                        delete v[element];
                                    });
                                }
                                productsArrayToConvert.push({product_id: product_id, title: pdata.title,...v})
                            })
                        }
                 
                    })
                   return setTimeout(() => {

                        console.log(productsArrayToConvert);
                        const csv = parse(productsArrayToConvert);                           
                        res.setHeader('Content-disposition', 'attachment; filename=Products.csv');
                        res.set('Content-Type', 'text/csv');
                       return  res.status(200).send(csv);
                    }, 2000)
                   
                } else {
                    return res.status(500).send("")
    
                }
            }).catch(e => {

                return res.status(500).send(e)
            })
        // } catch (error) {
        //     return res.status(500).send("")
        // }
    }
}
export default Admin