/* jshint node:true */
/* jshint esversion:6 */
/*global document, window, alert, console, require*/

var $ = require('jquery'),
    accounting = require('accounting'),
    dialog = require('electron').remote,
    fs = require('fs'),
    moment = require('moment'),
    path = require('path'),
    pikaday = require('pikaday'),
    pdf = require('html-pdf'),
    PouchDB = require('pouchdb'),
    Vue = require('vue'),

    invoices = new PouchDB('invoicesdata001'),
    settings = new PouchDB('settingsdata001'),

    dateformats = ['dddd, MMMM Do YYYY', 'DD/MM/YYYY', 'MMMM Do YYYY'];


PouchDB.plugin(require('pouchdb-upsert'));

Vue.component('tabs', {
    template: `
    <div>
        <div class="tabs is-centered" :class="this.type">
            <ul>
                <li v-for="tab in tabs" :class="{ 'is-active': tab.isActive }" > 
                    <a href="#" @click="selectTab(tab)"><i :class="tab.icon"></i>&nbsp; {{ tab.name }} </a>
                </li>
            </ul>
        </div>
        
        <div class="tabs-details">
            <slot></slot>
        </div>
    </div>
    `,

    data() {
        return {
            tabs: []
        };
    },
    created: function () {
        this.tabs = this.$children;
    },
    methods: {
        selectTab(selectedTab) {
            this.tabs.forEach(tab => {
                tab.isActive = (tab.name === selectedTab.name);
            });
        }
    },
    props: {
        type: {
            required: true
        }
    }
});


Vue.component('tab', {
    template: `<div v-show="isActive"><slot></slot></div>`,
    props: {
        icon: {
            required: true
        },
        name: {
            required: true
        },
        selected: {
            default: false
        }
    },
    data() {
        return {
            isActive: false
        };
    },
    mounted: function () {
        this.isActive = this.selected;
    }
});

var main = new Vue({
    el: '#main',

    data: {
        lineitems: [
            {
                description: "",
                quantity: "",
                unit_price: "",
            }
        ],
    },

    computed: {
        dueDate: function () {
            var date = this.date;
            return moment(date).add(30, 'days');
        }
    },

    mounted: function () {
        setInterval(this.now, 1000);
    },

    methods: {
        now: function () {
            this.date = moment();
        }
    },

    filters: {
        formatAsCurrency: function (amount) {
            return accounting.formatMoney(amount, "R", 2, ",", ".");
        },
        formatDate: function (date) {
            return moment(date).format(dateformats[$('#date_setting').prop('selectedIndex')]);
        }
    }
});

$(document).ready(function () {
    console.log($('#date_setting').prop('selectedIndex'));
})
