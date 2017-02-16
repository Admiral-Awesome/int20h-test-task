
/**
 * Service worker to make image.pdf & post to vk.com
 * @author Admiral_Awesome
 */
var dateFormat = require('dateformat');
var request = require("request");
var fs = require('fs');
var htmlConvert = require('html-convert');
var convert = htmlConvert();

//url чтобы втянуть токен
//https://oauth.vk.com/authorize?client_id=5111785&display=page&redirect_uri=https://oauth.vk.com/blank.html&scope=manage,docs,photos,wall,offline&response_type=token&v=5.37
var token = "20c9d8cbb570892********************************f51cbe5020563da5da89bfde8c"
var idVk = "140406955";
var _1plu1ApiUrl = "https://api.ovva.tv/v2/ru/tvguide/1plus1/";
var htmlFileName = "1plus1.html";

module.exports = {
    makeHTML: function (str) {
        console.log("html file generated ");
        return new Promise(function (resolve, reject) {
            fs.readFile("template.html", 'utf8', function (err, contents) {
                content = contents.replace("REPLACEME", str)

                fs.writeFile(htmlFileName, content, function (err) {
                    if (err) {
                        reject(err);
                    }

                    resolve("done");
                });

            });
        });
    },
    makeImage: function () {
        return new Promise(function (resolve, reject) {
            var stream = convert(htmlFileName)
                .pipe(fs.createWriteStream('program.png'))

            stream.on('finish', function () {
                resolve();
            });

        });
    },
    makePdf: function () {
        return new Promise(function (resolve, reject) {
            var stream = convert(htmlFileName, { format: 'pdf' })
                .pipe(fs.createWriteStream('program.pdf'));

            stream.on('finish', function () {
                resolve();
            });


        });
    },
    makeHTMLtext: function (content) {
        var time = dateFormat(new Date(), "dd.mm.yyyy");

        var result = "<h3> Программа на " + time + " </h3> \n";
        result += "<tbody>\n";
        var startTime, endTime, timeStr;
        for (var i = 0; i < content.length; i++) {

            startTime = dateFormat(new Date(content[i].realtime_begin * 1000), "HH:MM");
            endTime = dateFormat(new Date(content[i].realtime_end * 1000), "HH:MM");
            timeStr = startTime + " - " + endTime;
            result += "<tr> <td> <img src=" + content[i].image.preview + " > </td> <td> " + content[i].title + "<br/>" + " " + (content[i].subtitle.length > 0 ? content[i].subtitle + "<br>" : "") + "" + timeStr + " </td></tr>"
        }
        result += "</tbody>\n";

        return result;
    },
    uploadImage: function () {

        return new Promise(function (resolve, reject) {

            request("https://api.vk.com/method/photos.getWallUploadServer?group_id=" + idVk + "&access_token=" + token, function (err, resp, body) {

                body = JSON.parse(body).response;
                var formData = { photo: fs.createReadStream("program.png") };
                request.post({ url: body.upload_url, formData: formData }, function (err, resp, body) {
                    body = JSON.parse(body)
                    request("https://api.vk.com/method/photos.saveWallPhoto?group_id=" + idVk + "&access_token=" + token + "&photo=" + body.photo + "&server=" + body.server + "&hash=" + body.hash, function (err, resp, body) {
                        body = JSON.parse(body)
                        resolve({ photo: body.response[0].id });
                    })
                })

            })

        });
    },
    uploadPdf: function (photo) {
        return new Promise(function (resolve, reject) {

            request("https://api.vk.com/method/docs.getUploadServer?group_id=" + idVk + "&access_token=" + token, function (err, resp, body) {
                body = JSON.parse(body).response;

                var formData = { file: fs.createReadStream("program.pdf") };
                request.post({ url: body.upload_url, formData: formData }, function (err, resp, body) {
                    body = JSON.parse(body)
                    request("https://api.vk.com/method/docs.save?" + "&access_token=" + token + "&file=" + body.file, function (err, resp, body) {
                        body = JSON.parse(body)
                        request("https://api.vk.com/method/wall.post?owner_id=-" + idVk + "&v=5.37&attachments=doc-" + idVk + "_" + body.response[0].did + "," + photo + "&from_group=1&access_token=" + token, function (err, resp, body) {
                            resolve()
                        });
                    })
                })

            })

        });

    },
    getProgram: function () {
        var today = dateFormat(new Date(), "yyyy-mm-dd");
        console.time("EVETHING done in....:");
        console.log("******************STARTED********************");
        console.time("get program 1+1.....");
        request(_1plu1ApiUrl + "" + today, function (err, resp, body) {
            if (!body || err) {
                console.log("Api server error");
                return;
            }
            console.timeEnd("get program 1+1.....");
            body = JSON.parse(body).data.programs;
            var str = module.exports.makeHTMLtext(body)

            module.exports.makeHTML(str)
                .then(function (data) {
                    console.time("Make image ....");
                    return module.exports.makeImage();
                }).then(function () {
                    console.timeEnd("Make image ....")
                    console.time("Make pdf.....");
                    return module.exports.makePdf();
                }).then(function () {
                    console.timeEnd("Make pdf.....");
                    console.time("Uploading image.....");
                    return module.exports.uploadImage();
                }).then(function (data) {
                    console.timeEnd("Uploading image.....");
                    console.time("Uploading pdf.....");
                    module.exports.uploadPdf(data.photo);
                }).then(function() {
                    console.timeEnd("Uploading pdf.....");
                    console.timeEnd("EVETHING done in....:");
                    console.log("******************FINISHED********************");
                })
        });
    }
}

sails.on('lifted', function () {
    WorkerService.getProgram();
});