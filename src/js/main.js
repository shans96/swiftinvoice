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
    Vue = require('vue/dist/vue'),

    invoices = new PouchDB('invoicesdata001'),
    settings = new PouchDB('settingsdata001'),

    date_formats = ['dddd, MMMM Do YYYY', 'DD/MM/YYYY', 'MMMM Do YYYY'];

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

        invoice_vat_status: '',
        lineitems: [
            {
                description: "",
                quantity: "",
                unit_price: "",
                total_exc: "",
                vat_amount: "",
                total: ""
            }
        ],
        vat_total: 0,
        invoice_total: 0,

        display_line_item_exc: true,
        display_line_item_vat: true,
        display_due_date_pdf: true,
        
        invoices_list: null,
        invoices_payments: []
    },

    mounted: function () {
        
        settings.putIfNotExists('usersettings', {
            
        }).catch(function (err) {
            console.log(err);
        });
        
        this.retrieveInvoices();
    },

    methods: {

        addLineItem: function () {
            this.lineitems.push({
                description: "",
                quantity: "",
                unit_price: "",
                total_exc: "",
                vat_amount: "",
                total: ""
            });
        },

        deleteLineItem: function (index) {
            this.lineitems.splice(index, 1);
        },

        totalExcLineItemFormula: function (lineitem) {
            return lineitem.quantity * lineitem.unit_price;
        },

        vatLineItemFormula: function (lineitem) {
            return this.invoice_vat_status === "Calculate VAT" ? lineitem.quantity * lineitem.unit_price * 14 / 100 : 0;
        },

        totalLineItemFormula: function (lineitem) {
            return this.invoice_vat_status === "Calculate VAT" ? lineitem.quantity * lineitem.unit_price * 114 / 100 : lineitem.quantity * lineitem.unit_price;
        },

        saveInvoice: function () {
            var salesinvoice = {
                _id: $('#invoice_number').val(),
                invoicedate: $('#invoice_date').val(),
                invoiceduedate: $('#invoice_due_date').val(),
                clientname: $('#client_name').val(),
                clientemail: $('#client_email').val(),
                clientaddressline1: $('#client_address_line1').val(),
                clientaddressline2: $('#client_address_line2').val(),
                clientaddressline3: $('#client_address_line3').val(),
                clientaddressline4: $('#client_address_line4').val(),
                lineitems: this.lineitems,
                vattotal: this.vat_total,
                invoicebalance: this.invoice_total,
                invoicetotal: this.invoice_total
            };

            invoices.put(salesinvoice).then(function (response) {
                console.log(response);
            }).then(function () {
                //function to run mailto goes here
            }).then(function () {
                $('#invoice_date').val('');
                $('#invoice_due_date').val('');
                $('#client_email').val('');
                $('#client_address_line1').val('');
                $('#client_address_line2').val('');
                $('#client_address_line3').val('');
                $('#client_address_line4').val('');
                main.lineitems = [{
                    description: "",
                    quantity: "",
                    unit_price: "",
                    total_exc: "",
                    vat_amount: "",
                    total: ""
                    }];
                main.vat_total = 0;
                main.invoice_total = 0;

                invoiceNumberCalc();
                main.retrieveInvoices();
            }).catch(function (err) {
                console.log(err);
            });
        },
        
        retrieveInvoices: function () {
            this.invoices_list = [];
            invoices.allDocs({
                include_docs: true
            }).then(function (response) {
                main.invoices_list.push(response.rows);
            }).catch(function (err) {
                console.log(err);
            });
        },
        
        deleteInvoice: function (index) {
            invoices.get(this.invoices_list[0][index].doc._id).then(function (doc) {
                return invoices.remove(doc);
            }).then(function (result) {
                console.log(result);
            }).then(function () {
                invoiceNumberCalc();
            }).catch(function (err) {
                console.log(err);
            });
        }
    },

    computed: {

        totalExcLineItem: function () {
            var totals_exc_array = [];
            for (var index in this.lineitems) {
                var line_item_exc_vat = this.totalExcLineItemFormula(this.lineitems[index]);
                totals_exc_array.push(line_item_exc_vat);
                this.lineitems[index].total_exc = line_item_exc_vat;
            }
            return totals_exc_array;
        },

        vatLineItem: function () {
            var vat_array = [];
            for (var index in this.lineitems) {
                var line_item_vat = this.vatLineItemFormula(this.lineitems[index]);
                vat_array.push(line_item_vat);
                this.lineitems[index].vat_amount = line_item_vat;
            }
            return vat_array;
        },

        totalLineItem: function () {
            var totals_array = [];
            for (var index in this.lineitems) {
                var line_item_total = this.totalLineItemFormula(this.lineitems[index]);
                totals_array.push(line_item_total);
                this.lineitems[index].total = line_item_total;
            }
            return totals_array;
        },

        invoiceVAT: function () {
            var vat_sum = 0;
            for (var index in this.lineitems) {
                vat_sum += this.lineitems[index].vat_amount;
                this.vat_total = vat_sum;
            }
            return vat_sum;
        },

        invoiceTotal: function () {
            var line_items_sum = 0;
            for (var index in this.lineitems) {
                line_items_sum += this.lineitems[index].total;
                this.invoice_total = line_items_sum;
            }
            return line_items_sum;
        },

        colspans: function () {
            var initial_colspan;
            // set the initial colspan
            // then decide which columns to hide
            if (this.display_line_item_exc && this.display_line_item_vat) {
                initial_colspan = 6;
            } else if (this.display_line_item_exc || this.display_line_item_vat) {
                initial_colspan = 5;
            } else {
                initial_colspan = 4;
            }

            if (!this.display_line_item_exc) {
                $('.total_excl').hide();
            } else {
                $('.total_excl').show();
            }

            if (!this.display_line_item_vat) {
                $('.line_vat').hide();
            } else {
                $('.line_vat').show();
            }

            return initial_colspan;
        }
    },

    filters: {
        formatAsCurrency: function (amount) {
            return accounting.formatMoney(amount, "", 2, ",", ".");
        },
    }
});

var invoice_date_picker = new pikaday({
        field: $('#invoice_date')[0],
        format: date_formats[$('#date_setting').prop('selectedIndex')]
    }),

    invoice_due_date_picker = new pikaday({
        field: $('#invoice_due_date')[0],
        format: date_formats[$('#date_setting').prop('selectedIndex')]
    });

$(document).ready(function () {
    datePlaceholderUpdate();
    invoiceNumberCalc();
});

$('#date_setting, #payment_terms').on('change', function () {
    datePlaceholderUpdate();
});

$('#invoice_number_prefix').on('change', function () {
    invoiceNumberCalc();
});

function datePlaceholderUpdate() {
    var date_setting = date_formats[$('#date_setting').prop('selectedIndex')],
        payment_window = $('#payment_terms').val();

    $('#invoice_date').val(moment().format(date_setting));
    $('#invoice_due_date').val(moment().add(payment_window, 'days').format(date_setting));
}


function invoiceNumberCalc() {
    invoices.allDocs({
        include_docs: true
    }).then(function (response) {
        $('#invoice_number').val($('#invoice_number_prefix').val() + (response.rows.length + 1));
    }).catch(function (err) {
        console.log(err);
    });
}

function restoreSettings() {
    settings.get('usersettings').then(function (response) {
        console.log(response);
    }).catch(function (err) {
        console.log(err);
    });
}