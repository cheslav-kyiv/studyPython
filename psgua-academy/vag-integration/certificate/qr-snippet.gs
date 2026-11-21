// Вставити в issueRow_() одразу ПІСЛЯ рядка:
//   Object.keys(repl).forEach(k => pres.replaceAllText(k, repl[k]));
    // QR-код: фігуру з текстом {{QR}} у шаблоні замінюємо на QR з посиланням на перевірку
    const verifyUrl = SITE + 'verify.html?id=' + certId;
    pres.getSlides().forEach(function (slide) {
      slide.getShapes().forEach(function (el) {
        if (el.getText().asString().indexOf('{{QR}}') !== -1) {
          const qr = UrlFetchApp.fetch('https://quickchart.io/qr?size=400&margin=1&ecLevel=M&text=' + encodeURIComponent(verifyUrl)).getBlob();
          el.replaceWithImage(qr);
        }
      });
    });
