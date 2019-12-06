let Utils = {
    getEmailMarkup: (email_content) => {
        return	`		
                        <html>
                          <head>
                            <link href="https://fonts.googleapis.com/css?family=Work+Sans:300,400,600,700&display=swap" rel="stylesheet">
                            <style>
                            .email-container{
                              width: 500px;
                              margin: 0 auto;
                              font-family: 'Work Sans', sans-serif;
                              color: #212529;
                              font-size: 16px;
                          }
                          .email-header{
                            text-align: center;
                            padding: 15px;
                            background: #ecf6ec;
                          }
                          .email-header img{
                            width: 100px;
                          }
                          .email-content{
                            padding: 15px;
                            padding-top: 30px;
                            padding-bottom: 30px;
                            padding-left: 0;
                            padding-right: 0;
                          }
                          .email-footer{
                            padding: 15px;
                          }
                          .bold{
                            font-weight: 700;
                          }
                          .row{
                            clear: both;
                            overflow: hidden;
                            padding: 15px 5px;
                          }
                          .w-50{
                            width: 50%;
                            float: left;
                          }
                          .w-50{
                            width: 50%;
                          }
                          .w-30{
                            width: 30%;
                          }
                          .w-20{
                            width: 20%;
                          }
                          .text-left{
                            text-align: left;
                          }
                          .text-right{
                            text-align: right;
                          }
                          .text-center{
                            text-align: center;
                          }
                          .text-green{
                            color: #48A748;
                          }
                          p{
                            margin: 0;
                            margin-bottom: 25px;
                          }
                          .border-grey{
                            border: 1px solid #c4c8c4;
                          } 
                          th, td{
                            padding: 5px;
                          } 
                          .mb-25{
                            margin-bottom: 25px;
                          }
                          .mb-05{
                            margin-bottom: 10px;
                          }
                          table{
                            padding-top: 15px;
                            padding-bottom: 15px;
                          }
                          .email-footer{
                            position: relative;
                          }
                          .d-block{
                            display: block;
                          }
                          .d-flex{
                            display: flex;
                          }
                          .d-inline-block {
                              display: inline-block!important;
                          }
                          .flex-column {
                              flex-direction: column!important;
                          }
                          .justufy-between{
                            justify-content: space-between;
                          }
                          .mb-4{
                            margin-bottom: 1.5rem!important;
                          }
                          .product-cartimage {
                              padding-right: 10px;
                              width: 17%;
                          }
                          .product-cartimage img {
                              object-fit: cover;
                              border-radius: 50%;
                          }
                          .product-details {
                              width: 100%;
                          }
                          .product-size-c {
                              font-size: 14px;
                              line-height: 14px;
                              margin-top: 5px;
                              font-style: italic;
                          }
                          .list-text-block{
                            background-color: #f1f3f4;
                            padding: 15px;
                            margin-bottom: 30px;
                            margin-left: -15px;
                            margin-right: -15px;
                            font-size: 16px;
                            line-height: 22px;
                          }  
                          .list-text-block .mb-5{
                            margin-bottom: 7px;
                          }
                          .mb-0{
                            margin-bottom: 0 !important;
                          }
                          .summary-item {
                            display: flex;
                            justify-content: space-between;
                            padding-top: 10px;
                            padding-bottom: 10px;
                          }
                        
                          .email-footer{
                            text-align: center;
                            padding: 25px 15px;
                            background: #ecf6ec;
                          }
                          .text-green{
                            color: #47a748;
                          }
                        
                          .mb-10{
                            margin-bottom: 10px;
                          }
                        
                          .text-capitalize{
                            text-transform: capitalize;
                          }
                        
                          .border-grey-y{
                            border-top: 1px solid hsla(0,0%,48.6%,.5);
                            border-bottom: 1px solid hsla(0,0%,48.6%,.5);
                          }
                        
                          .mt-8{
                            margin-top: 8px;
                          }
                        
                          .w-50{
                            width: 50%;
                          }
                        
                          .px-15{
                            padding-left: 15px;
                            padding-right: 15px;
                            }
                            </style>

                        </head>
                        <body>
                          <div class="email-container">

                          <div class="email-header">
                            <img src="https://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/logo_new.png">
                          </div>
                        
                          <div class="email-content">
                              <div class="px-15">${email_content.msg}</div>
                              <p class="bold mb-10 px-15">Order Details</p>
                        
                              <div class="d-flex mb-25 justufy-between px-15">
                                  <div class="mb-5 w-50">Order no: <i>${email_content.order_nos}</i></div>
                                  <div class="w-50 text-right">Date: <i>${email_content.date}</i></div>
                              </div>
                        
                              <div class="order-items px-15">
                               ${email_content.items}                       
                              </div>
                        
                              <div class="list-text-block ">
                                  <div class=""><strong>Delivery Address : </strong></div>${email_content.address}
                              </div>
                        
                              <div class="bill-details px-15">
                                 ${email_content.summary}
                              </div>
                        
                          </div>
                        
                          <div class="email-footer text-center">
                            (C) 2018 Digital Dwarves Pvt Ltd. All Right Reserved
                          </div>
                        
                        </div>
                        </body>
        
                    </html>
                    `
        }
}

export default Utils;