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
                              font-size: 14px;
                          }
                          .email-header{
                            text-align: center;
                            padding: 15px;
                            background: #ecf6ec;
                          }
                          .email-header img{
                            width: 100px;
                            vertical-align: middle;
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
                          }
                          .list-text-block{
                            padding: 15px;
                            padding-top: 0;
                            padding-bottom: 0;
                            margin-bottom: 25px;
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
                            padding: 15px 15px;
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
                        
                          .follow-text a{
                            margin-right: 10px;    
                          }
                        
                          .follow-text a:last-child{
                            margin-right: 0;
                          }
                        
                          .font-size-16{
                            font-size: 16px;
                          }
                        
                          .mb-5{
                            margin-bottom: 5px;
                          }
                        
                          .mb-15{
                            margin-bottom: 15px;
                          }
                        
                          .border-double{
                            border-top: 4px double #47a748;
                            border-bottom: 4px double #47a748;
                            padding-top: 1.5rem;
                          }
                        
                          .order-items{
                            margin-bottom: 15px;
                          }
                        
                          .clearfix{
                            clear: both;
                            overflow: hidden;
                          }
                          
                          .font-size-12{
                            font-size: 12px;
                          }
                        </style>   

                        </head>
                        <body>
                          <div class="email-container" style="max-width: 500px; width:100%;margin: 0 auto; font-family: 'Work Sans',sans-serif; color: #212529; font-size: 14px;">
                            <div class="email-header" style="text-align: center; padding: 15px; background: #ecf6ec;">
                              <div class="logo" style="width: 100%;">
                                <img src="http://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/GGB-logo.png" style="width: 100px;
                                vertical-align: middle;" />
                              </div>                              
                            </div>
                            <div class="email-content" style="padding: 15px; padding-top: 30px; padding-bottom: 30px; padding-left: 0; padding-right: 0;">
                                <div class="" style="margin-bottom:25px;clear:both;overflow:hidden;display:flex;">
                                  <div class="" style="text-align:left;padding-left:15px;width:50%;float:left;">
                                    <img src="http://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/slidein/checkout.png" style="width:17px;display:inline-block;vertical-align:middle;" />
                                    <span style="font-weight: 600;text-transform: uppercase;font-size: 12px;display:inline-block;vertical-align:middle;margin-left: 2px;">Order placed</span>
                                  </div>
                                  <div class="order-number text-right" style="padding-right:15px;text-align:right;width:50%;float:left;margin-bottom:0;">
                                    Order no: <strong><a href="${email_content.url}">${email_content.order_nos}</a></strong>
                                  </div>
                                </div>
                                <div class="px-15" style="padding-left: 15px; padding-right: 15px;">${email_content.msg}</div>

                                <p class="bold mb-10 px-15" style="margin-bottom: 5px;padding-left: 15px; padding-right: 15px;font-weight:700;">Order Details</p>
                          
                                <div class="d-flex mb-25 justufy-between px-15" style="padding-left: 15px; padding-right: 15px;margin-bottom:25px;clear:both;overflow:hidden;">

                                    <div class="mb-5 w-50" style="margin-bottom:5px;width:50%;float:left;">Order no:<strong> <a href="${email_content.url}">${email_content.order_nos}</a></strong></div>
                                    <div class="w-50 text-right" style="width: 50%;text-align: right;float:left;">Date: ${email_content.date}</div>
                                </div>
                                
                                <div class="list-text-block" style="padding: 15px; padding-top: 0; padding-bottom: 0; margin-bottom: 25px; line-height: 22px;">
                                  ${email_content.address}
                                </div>
                                <div class="order-items px-15" style="margin-bottom: 15px;padding-left: 15px;padding-right: 15px;">
                                  <div class="border-double" style="border-top: 4px double #47a748; border-bottom: 4px double #47a748; padding-top: 1.5rem;">
                                    ${email_content.items}    
                                  </div>                   
                                </div>
                                <div class="bill-details px-15" style="padding-left: 15px;padding-right: 15px;">
                                  ${email_content.summary}
                                </div>
                          
                            </div>
                          
                            <div class="email-footer" style="padding: 15px 15px; background: #ecf6ec;position: relative;">
                              <div class="" style="clear: both; overflow: hidden;">
                                <div class="follow-text mb-15 w-50 text-left" style="margin-bottom: 15px;width: 50%;text-align:left;float:left;">
                                    <p class="mb-5" style="margin-bottom: 5px;margnin-top:0;"><strong>Follow Us</strong></p>
                                    <a href="#" class="d-inline-block" style="text-decoration: none;">
                                      <img width="30" src="https://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/fb.png"/>
                                    </a>
                                    <a href="#" class="d-inline-block" style="text-decoration: none;">
                                      <img width="30" src="https://greengrainbowl.com/wp-content/themes/ajency-portfolio/images/insta.png"/>
                                    </a>
                                </div>
                                <div class="contact-text w-50 text-right" style="width:50%;text-align:right;float:left;">
                                  <p class="mb-5" style="margin-bottom: 5px;margnin-top:0;"><strong>Need help?</strong></p>
                                  <p class="mb-5" style="margin-bottom: 5px;margnin-top:0;">Email: <a class="text-green" href="mailto:test@test.com" style="color:#47a748;text-decoration: underline;">test@test.com</a></p>
                                  <p class="mb-15" style="margnin-top:0;">Mobile: <a class="text-green" href="https://api.whatsapp.com/send?phone=+917770004258" style="color: #47a748;text-decoration: underline;">7770004258</a></p>      
                                </div>     
                              </div>                         
                              <div class="text-center clearfix font-size-12" style="font-size: 12px;clear: both; overflow: hidden;text-align: center;">(C) 2019 Digital Dwarves Pvt Ltd. All Right Reserved</div>
                            </div>                        
                          </div>
                        </body>
        
                    </html>
                    `
        }
}

export default Utils;