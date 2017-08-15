// dependencies
const readline = require('readline');
const aws = require('aws-sdk');
aws.config.update({ region: 'eu-west-1' });
var DV = require('./dateValidator.js');
var error = false;
var errorMessage = [];


exports.handler = (event, context, callback) => {
// read S3 object stream
    console.log("starting upload wrapper");
    var s3 = new aws.S3({ apiVersion: '2006-03-01' });
    var bucket = event.Records[0].s3.bucket.name;
    var key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));
    var params = {
        Bucket: bucket,
        Key: key
    };
    console.log("bucket ID: " + bucket +", key: "+key);
        getS3Header(s3, params, context, event, processFile);
    }


//get the header object
getS3Header = function (s3, params, context, event, _callback) {
    var uploadObj = {
        uploadUUID: generateUUID(),
        user: "",
        organisation: "",
        comments: "",
        frequency: "",
        category: "",
        commences: "",
        sequence: 0
    }
  
    s3.headObject(params, function (error, response) {
        if (error) {
            context.callbackWaitsForEmptyEventLoop = false;
            console.log("failed to get header from S3");
            console.log(error);
        } else {
            console.log("got header from S3");
            uploadObj.user = response.Metadata.user;
            if (uploadObj.user == undefined) {
                uploadObj.user = "NULL";
                error = true;
                errorMessage.push("user must not be blank");
                 }
            uploadObj.organisation = response.Metadata.organisation;
            if (uploadObj.organisation == undefined) {
                uploadObj.organisation = "NULL";
                }
            uploadObj.comments = response.Metadata.comments;
            if (uploadObj.comments == undefined) {
                uploadObj.comments = "NULL";
                }
            uploadObj.frequency = response.Metadata.frequency;
            if (uploadObj.frequency == undefined) {
                uploadObj.frequency = "NULL";
                error = true;
                errorMessage.push("frequency must not be blank");
                }
            uploadObj.category = response.Metadata.category;
            if (uploadObj.category == undefined) {
                uploadObj.category = "NULL";
                error = true;
                errorMessage.push("category must not be blank");
            }
            uploadObj.commences = response.Metadata.commences;
            if (uploadObj.commences == undefined) {
                uploadObj.commences = "NULL";
                error=true;
                errorMessage.push("commences must not be blank");
            }
            uploadObj.sequence = createSequence(uploadObj.commences, uploadObj.frequency);
            
            if (error){
               raiseError(uploadObj.uploadUUID, uploadObj.user, errorMessage)
               console.log("upload process stopped - invalid parameters.  No ICINs have been updated.")
               return;
            }else{
                _callback(uploadObj, params, s3, event, context);
            }
        }
    });
}

processFile = function (uploadObj, params, s3, event, context) {
    var ICIN;
    var NAV;
    var calculationDate;
    var header = true;
    var shareClassDescription;
    var calculateSRRI;
    var count = 0;
    //get the document 
    const rl = readline.createInterface({
        input: s3.getObject(params).createReadStream()
    });

    /* TODO validate; if error publish unprocessed file topic and quit */
    console.log("start reading file");
    rl.on('line', function (line) {
        if (header == false) {
            var array = line.split(",");
            ICIN = array[0];
            shareClassDescription = array[1];
            NAV = array[2];
            calculationDate = array[3];
            calculateSRRI = array[4];
            count += 1;

            //send the share class, for processing
            var message = {
                requestUUID: uploadObj.uploadUUID,
                ICIN: ICIN,
                NAV: NAV,
                category: uploadObj.category,
                frequency: uploadObj.frequency,
                user: uploadObj.user,
                description: shareClassDescription,
                expectedSequence: uploadObj.sequence.toString(),
                calculateSRRI: calculateSRRI,
                calculationDate: calculationDate
            }

            console.log("request update NAV for ICIN :" + ICIN);
            sendLambdaSNS(event, context, message, "arn:aws:sns:eu-west-1:437622887029:updateNAV", "update NAV request");

        } else {
            header = false;
        }
      }) .on('close', function () {
    console.log("finished processing all records");
    //write header to db
    writeDynamoRecs(uploadObj.uploadUUID, uploadObj.user, uploadObj.organisation, uploadObj.frequency, uploadObj.category, count, uploadObj.comments, uploadObj.sequence)
    //publish completion to SNS
});
    }

writeDynamoRecs = function (uuid, user, organisation, frequency, category, count, comments, sequence) {
    //write to the database
    console.log("write record to upload history");
    var dynamo = new aws.DynamoDB();
    var tableName = "UploadHistory";
    var item = {
        RequestUUID: {"S": uuid},
        CreatedTimeStamp: {"N": new Date().getTime().toString()},
        CreatedDateTime: {"S": new Date().toUTCString()},
        Organisation: {"S": organisation},
        CreateUser: {"S": user},
        Frequency: {"S": frequency},
        Category: {"S": category},
        ShareClassCount: {"N": count.toString()},
        Sequence: {"N": sequence.toString()},
        Comments: {"S": comments}
    }
    console.log(item);
    var params = {
        TableName: tableName,
        Item: item
    }
   
    dynamo.putItem(params, function (err, data) {
        if (err) console.log("ERROR", err);
        else console.log("SUCCESS", data);
    });
}

sendLambdaSNS = function (event, context, message, topic, subject) {
    var sns = new aws.SNS();
    console.log("send the ", message);
    var params = {
        Message: JSON.stringify(message),
        Subject: subject,
        TopicArn: topic
    };
    sns.publish(params, context.done);
    return null;
}

function generateUUID() { // Public Domain/MIT
    var d = new Date().getTime();
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
        d += performance.now(); //use high-precision timer if available
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

createSequence = function(dateIn, frequency){
    var dateInDate = DV.dateFactory(dateIn);
    
    if(DV.isValidDate(dateInDate)){
         var sequence = DV.sequenceFactory(dateInDate, frequency);
    } else{
        sequence = "";
        error = true;
        errorMessage.push("Invalid date entered: upload stopped. No NAV updated");
    }
    return sequence;
}
raiseError = function (requestUUID, user, errorMessage) {
    //write to the database
    var dynamo = new aws.DynamoDB();
    var tableName = "errorLog";
    var item = {
        RequestUUID: {"S": requestUUID},
        CreatedTimeStamp: {"N": new Date().getTime().toString()},
        CreatedDateTime: {"S":  new Date().toUTCString()},
        CreateUser: {"S": user},
        Stage: {"S": "Upload Wrapper"},
        Error: {"S": errorMessage}
    }

    var params = {
        TableName: tableName,
        Item: item
    }

    dynamo.putItem(params, function (err, data) {
        if (err) {
            console.log("ERROR", err);
            context.fail();
        }
        else {
            console.log("SUCCESS", data);
            context.done();
        }
        
    });
}

