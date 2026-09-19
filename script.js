/* =========================================================
   FURKAN SAĞDIÇ — SİTE BETİĞİ
   Yazı boyutu kontrolü + mobil menü
   ========================================================= */


(function () {

    "use strict";


    /* ---- Yazı Boyutu Kontrolü ---- */

    var kok = document.documentElement;

    var mevcut = parseFloat(localStorage.getItem("yaziOlcek")) || 1;

    var adim = 0.1;

    var min = 0.8;

    var max = 1.6;


    function uygula() {

        kok.style.setProperty("--yazi-olcek", mevcut);

        localStorage.setItem("yaziOlcek", mevcut);

    }


    uygula();


    var buyutButon = document.getElementById("buyut");

    var kucultButon = document.getElementById("kucult");

    var sifirlaButon = document.getElementById("sifirla");


    if (buyutButon) {

        buyutButon.addEventListener("click", function () {

            if (mevcut < max) {

                mevcut = Math.round((mevcut + adim) * 10) / 10;

                uygula();

            }

        });

    }


    if (kucultButon) {

        kucultButon.addEventListener("click", function () {

            if (mevcut > min) {

                mevcut = Math.round((mevcut - adim) * 10) / 10;

                uygula();

            }

        });

    }


    if (sifirlaButon) {

        sifirlaButon.addEventListener("click", function () {

            mevcut = 1;

            uygula();

        });

    }



    /* ---- Mobil Menü ---- */

    var menuButon = document.getElementById("menu-buton");

    var anaMenu = document.getElementById("ana-menu");


    if (menuButon && anaMenu) {

        menuButon.addEventListener("click", function () {

            anaMenu.classList.toggle("acik");

        });

    }


})();
