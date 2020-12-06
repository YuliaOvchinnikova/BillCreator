var express = require("express");
var multer = require("multer");
var upload = multer({ dest: "uploads/" });
const parse = require("csv-parse/lib/sync");
const fs = require("fs");
const PDFDocument = require("../utils/pdf-tables");

var router = express.Router();

let db = new Map();

// Upload data file
router.post("/", upload.single("myfile"), function (req, res, next) {
  let newRecord = {
    duedate: req.body.dueDate,
    accountnumber: req.body.accountNumber,
    message: req.body.message,
    records: parseData(req.file.path, req.body.dueDate),
  };

  fs.unlinkSync(req.file.path);

  db[req.session.id] = newRecord;

  res.render("data", newRecord);
});

const parseData = (path, dueDate) => {
  let parsedRecords = parse(fs.readFileSync(path), {
    columns: true,
    skip_empty_lines: true,
    delimiter: ";",
  });

  return parsedRecords.map((r, index) => ({
    lastname: r["Last name"],
    firstname: r["First name"],
    address: r["Address"],
    postalcode: r["Postal code"],
    postoffice: r["Post office"],
    email: r["Email"],
    referencenumber: generateReferenceNumber(index, dueDate),
  }));
};

// Create PDF doc
router.get("/full_report", function (req, res, next) {
  const doc = new PDFDocument({
    layout: "landscape",
  });

  doc.pipe(res);

  // Create table for HTML
  let rows = db[req.session.id].records.map((r) => {
    return [
      r.lastname,
      r.firstname,
      r.address,
      r.postalcode,
      r.postoffice,
      r.email,
      r.referencenumber,
    ];
  });
  const table = {
    headers: [
      "Last name",
      "First name",
      "Address",
      "Postal code",
      "Post office",
      "Email",
      "Reference number",
    ],
    rows,
  };
  doc.table(table, {
    prepareHeader: () => doc.font("Helvetica-Bold"),
    prepareRow: (row, i) => doc.font("Helvetica").fontSize(12),
  });
  doc.end();
});

router.get("/bills", function (req, res, next) {
  const doc = new PDFDocument();

  doc.pipe(res);

  // PDF bills for everyone who doesnt have email
  db[req.session.id].records
    .filter((r) => r.email === "")
    .forEach((r) => {
      doc
        .text("Company Ltd.", 200, 50, { align: "right" })
        .text("Helsiginkatu 26", 200, 65, { align: "right" })
        .text("Helsinki, Uusimaa, 02220", 200, 80, { align: "right" })
        .moveDown();

      doc.fillColor("#444444").fontSize(20).text("Bill", 50, 160);

      const customerInformationTop = 200;

      generateHr(doc, customerInformationTop - 20);

      doc
        .fontSize(10)
        .text("Account number IBAN:", 50, customerInformationTop)
        .font("Helvetica-Bold")
        .text(db[req.session.id].accountnumber, 170, customerInformationTop)
        .font("Helvetica")
        .text("Due Date:", 50, customerInformationTop + 15)
        .text(db[req.session.id].duedate, 170, customerInformationTop + 15)
        .text("Reference Number:", 50, customerInformationTop + 30)
        .font("Helvetica-Bold")
        .text(r.referencenumber, 170, customerInformationTop + 30)
        .font("Helvetica-Bold")
        .text(r.lastname + " " + r.firstname, 300, customerInformationTop)
        .font("Helvetica")
        .text(r.address, 300, customerInformationTop + 15)
        .text(
          r.postalcode + ", " + r.postoffice,
          300,
          customerInformationTop + 30
        )
        .moveDown();

      generateHr(doc, customerInformationTop + 50);
      doc
        .font("Helvetica-Bold")
        .text("Message:", 50, customerInformationTop + 60)
        .font("Helvetica")
        .text(db[req.session.id].message, 170, customerInformationTop + 60);

      doc.addPage();
    });

  doc.end();
});

function generateHr(doc, y) {
  doc.strokeColor("#aaaaaa").lineWidth(1).moveTo(50, y).lineTo(550, y).stroke();
}
// Generate reference number
function generateReferenceNumber(index, date) {
  date = date.replace(/-/g, "");

  let checksum = [7, 3, 1];
  let checksumIndex = 0;

  let result = index + date;
  let arr = result.split("").reverse();
  let sum = 0;

  for (var i = 0; i < arr.length; i++) {
    sum += arr[i] * checksum[checksumIndex];
    checksumIndex++;
    if (checksumIndex >= checksum.length) {
      checksumIndex = 0;
    }
  }

  let lastChar = 10 - (sum % 10);
  if (lastChar == 10) {
    lastChar = 0;
  }

  return result + lastChar;
}

module.exports = router;
