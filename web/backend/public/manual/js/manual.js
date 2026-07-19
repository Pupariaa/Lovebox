(function () {
  var printBtn = document.getElementById("print-btn");
  if (printBtn) {
    printBtn.addEventListener("click", function () {
      window.print();
    });
  }

  var tocLinks = document.querySelectorAll(".manual-toc a");
  var sections = [];

  tocLinks.forEach(function (link) {
    var href = link.getAttribute("href");
    if (!href || href.charAt(0) !== "#") return;
    var el = document.getElementById(href.slice(1));
    if (el) sections.push({ link: link, el: el });
  });

  if (!sections.length || !("IntersectionObserver" in window)) return;

  var observer = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        tocLinks.forEach(function (l) {
          l.classList.remove("is-active");
        });
        sections.forEach(function (s) {
          if (s.el === entry.target) s.link.classList.add("is-active");
        });
      });
    },
    { rootMargin: "-20% 0px -65% 0px", threshold: 0 }
  );

  sections.forEach(function (s) {
    observer.observe(s.el);
  });
})();
