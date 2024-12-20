const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const fs = require("fs/promises");
const {defineString} = require("firebase-functions/params");
const {onInit} = require("firebase-functions/v2/core");
const {log} = require("firebase-functions/logger");

const readHTMLFile = async function(path) {
  return await fs.readFile(path, {encoding: "utf-8"});
};

// Define some parameters
const user = defineString("USER_EMAIL");
const pass = defineString("PASSWORD_EMAIL");
const secondaryEmail = defineString("SECONDARY_EMAIL");

/* const smtpTransport = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: user.value(),
    pass: pass.value(),
  },
});*/

const smtpTransport = nodemailer.createTransport({
  service: "microsoft",
  host: "smtp.office365.com",
  port: 587,
  auth: {
    user: user.value(),
    pass: pass.value(),
  },
  secure: false,
  secureConnection: true,
  tls: {
    ciphers: "SSLv3",
  },
});


onInit(() => {
  /* {
    service: "Outlook365",
    host: "smtp-mail.outlook.com",
    port: 587,
    tls: {
      ciphers: "SSLv3",
    },
    secureConnection: false,
    auth: {
      user: user.value(),
      pass: pass.value(),
    },
  } */

  smtpTransport.verify((error, success) => {
    if (error) {
      log(error);
    } else {
      log("Server is ready to take our messages");
    }
  });
});


module.exports = async function sendEmail(
    to,
    subject,
    replacements,
    sendCopy = true) {
  const html = await readHTMLFile(__dirname + "/email.html");

  const template = handlebars.compile(html);

  const htmlToSend = template(replacements);
  const mailOptions = {
    from: user.value(),
    to: to,
    subject: subject,
    html: htmlToSend,
  };

  if (sendCopy) {
    mailOptions.bcc = [user.value(), secondaryEmail.value()];
  }

  return await smtpTransport.sendMail(mailOptions);
};
