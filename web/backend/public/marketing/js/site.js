(function () {
  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".menu-toggle");
  var mobile = document.querySelector(".nav-mobile");
  var cookie = document.querySelector(".cookie-banner");
  var key = "bac_cookie_consent";

  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toggle && mobile) {
    toggle.addEventListener("click", function () {
      var open = mobile.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.style.overflow = open ? "hidden" : "";
    });
    mobile.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        mobile.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        document.body.style.overflow = "";
      });
    });
  }

  if (cookie && !localStorage.getItem(key)) {
    cookie.classList.add("is-visible");
    cookie.querySelector(".accept")?.addEventListener("click", function () {
      localStorage.setItem(key, "1");
      cookie.classList.remove("is-visible");
    });
    cookie.querySelector(".decline")?.addEventListener("click", function () {
      localStorage.setItem(key, "0");
      cookie.classList.remove("is-visible");
    });
  }

  var obs = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) e.target.classList.add("is-visible");
      });
    },
    { threshold: 0.12 }
  );
    document.querySelectorAll(".step, .feature, .timeline-item, .scene-card").forEach(function (el) {
    obs.observe(el);
  });
})();
