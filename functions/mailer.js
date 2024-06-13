const nodemailer = require("nodemailer");
const handlebars = require("handlebars");
const fs = require("fs/promises");
const {defineString} = require("firebase-functions/params");

const readHTMLFile = async function(path) {
  return await fs.readFile(path, {encoding: "utf-8"});
};

// Define some parameters
const user = defineString("USER_EMAIL");
const pass = defineString("PASSWORD_EMAIL");

const smtpTransport = nodemailer.createTransport({
  service: "microsoft",
  host: "smtp.office365.com",
  port: 587,
  tls: {
    ciphers: "SSLv3",
  },
  secureConnection: true,
  auth: {
    user: user.value(),
    pass: pass.value(),
  },
});


module.exports = async function sendEmail(to, subject, replacements) {
  const html = await readHTMLFile(__dirname + "/email.html");

  const template = handlebars.compile(html);

  const htmlToSend = template(replacements);
  const mailOptions = {
    from: user.value(),
    to: to,
    subject: subject,
    html: htmlToSend,
  };
  return await smtpTransport.sendMail(mailOptions);
};
