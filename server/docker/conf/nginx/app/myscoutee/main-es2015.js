(window["webpackJsonp"] = window["webpackJsonp"] || []).push([["main"],{

/***/ "+KWR":
/*!*******************************************!*\
  !*** ./src/lib/ms-list/ms-panel/index.ts ***!
  \*******************************************/
/*! exports provided: MsPanel */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MsPanel", function() { return MsPanel; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var rxjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! rxjs */ "qCKp");
/* harmony import */ var _ms_action__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../ms-action */ "JCxZ");
/* harmony import */ var _angular_material_dialog__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/material/dialog */ "0IaG");
/* harmony import */ var _angular_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @angular/router */ "tyNb");
/* harmony import */ var _angular_material_bottom_sheet__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @angular/material/bottom-sheet */ "2ChS");
/* harmony import */ var src_app_services_list_service__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! src/app/services/list.service */ "YoPC");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _angular_material_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @angular/material/button */ "bTqV");
/* harmony import */ var _angular_material_card__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @angular/material/card */ "Wp6s");
/* harmony import */ var _angular_material_core__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @angular/material/core */ "FKr1");
/* harmony import */ var _angular_material_icon__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @angular/material/icon */ "NFeN");













const _c0 = ["panel"];
function MsPanel_ng_container_2_ng_container_2_mat_card_header_2_mat_card_subtitle_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "mat-card-subtitle");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r12 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"](" ", ctx_r12.data.header.sub, " ");
} }
function MsPanel_ng_container_2_ng_container_2_mat_card_header_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "mat-card-header");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "mat-card-title");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](3, MsPanel_ng_container_2_ng_container_2_mat_card_header_2_mat_card_subtitle_3_Template, 2, 1, "mat-card-subtitle", 12);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r10 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](ctx_r10.data.header.main);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r10.data.header.sub);
} }
function MsPanel_ng_container_2_ng_container_2_mat_card_footer_6_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "mat-card-footer");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r11 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](ctx_r11.data.footer);
} }
function MsPanel_ng_container_2_ng_container_2_Template(rf, ctx) { if (rf & 1) {
    const _r14 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "mat-card", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function MsPanel_ng_container_2_ng_container_2_Template_mat_card_click_1_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r14); const ctx_r13 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2); return ctx_r13.content(); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](2, MsPanel_ng_container_2_ng_container_2_mat_card_header_2_Template, 4, 2, "mat-card-header", 12);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](3, "mat-card-content");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](4, "p");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](6, MsPanel_ng_container_2_ng_container_2_mat_card_footer_6_Template, 2, 1, "mat-card-footer", 12);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerEnd"]();
} if (rf & 2) {
    const ctx_r2 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵstyleProp"]("background-color", ctx_r2.data.color);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r2.data.header);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](ctx_r2.data.desc);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r2.data.footer);
} }
function MsPanel_ng_container_2_ng_container_3_img_1_Template(rf, ctx) { if (rf & 1) {
    const _r20 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "img", 17);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function MsPanel_ng_container_2_ng_container_3_img_1_Template_img_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r20); const ctx_r19 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3); return ctx_r19.content(); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r15 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("src", ctx_r15.data.imgs[ctx_r15.currentIdx], _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵsanitizeUrl"]);
} }
const _c1 = function (a0) { return { "slide_active": a0 }; };
function MsPanel_ng_container_2_ng_container_3_div_2_div_1_Template(rf, ctx) { if (rf & 1) {
    const _r25 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 20);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function MsPanel_ng_container_2_ng_container_3_div_2_div_1_Template_div_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r25); const idx_r23 = ctx.index; const ctx_r24 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](4); return ctx_r24.slide(idx_r23); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](1, "div", 21);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const idx_r23 = ctx.index;
    const ctx_r21 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction1"](1, _c1, ctx_r21.currentIdx === idx_r23));
} }
function MsPanel_ng_container_2_ng_container_3_div_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 18);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](1, MsPanel_ng_container_2_ng_container_3_div_2_div_1_Template, 2, 3, "div", 19);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r16 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngForOf", ctx_r16.data.imgs);
} }
function MsPanel_ng_container_2_ng_container_3_div_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 22);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "b");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r17 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵstyleProp"]("background", ctx_r17.data.color);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("", ctx_r17.data.header.main, "\u00A0");
} }
function MsPanel_ng_container_2_ng_container_3_div_4_div_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 25);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "mat-icon");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r26 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵstyleProp"]("color", ctx_r26.data.role.color);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](ctx_r26.data.role.icon);
} }
function MsPanel_ng_container_2_ng_container_3_div_4_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 23);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "b");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](3, MsPanel_ng_container_2_ng_container_3_div_4_div_3_Template, 3, 3, "div", 24);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r18 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate1"]("", ctx_r18.data.header.sub, "\u00A0");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r18.data.role);
} }
function MsPanel_ng_container_2_ng_container_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](1, MsPanel_ng_container_2_ng_container_3_img_1_Template, 1, 1, "img", 13);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](2, MsPanel_ng_container_2_ng_container_3_div_2_Template, 2, 1, "div", 14);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](3, MsPanel_ng_container_2_ng_container_3_div_3_Template, 3, 3, "div", 15);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](4, MsPanel_ng_container_2_ng_container_3_div_4_Template, 4, 2, "div", 16);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerEnd"]();
} if (rf & 2) {
    const ctx_r3 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r3.data.imgs && ctx_r3.visible);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r3.data.imgs && ctx_r3.data.imgs.size > 0 && ctx_r3.visible);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r3.data.header && ctx_r3.visible);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r3.data.header && ctx_r3.visible);
} }
function MsPanel_ng_container_2_button_4_div_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 29);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r27 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](ctx_r27.data.rate);
} }
function MsPanel_ng_container_2_button_4_Template(rf, ctx) { if (rf & 1) {
    const _r29 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "button", 26);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function MsPanel_ng_container_2_button_4_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r29); const ctx_r28 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2); return ctx_r28.rate(); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "mat-icon", 27);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "rate_ext");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](3, MsPanel_ng_container_2_button_4_div_3_Template, 2, 1, "div", 28);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r4 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("color", ctx_r4.rated ? "warn" : "primary");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r4.data.rate);
} }
function MsPanel_ng_container_2_button_5_Template(rf, ctx) { if (rf & 1) {
    const _r31 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "button", 26);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function MsPanel_ng_container_2_button_5_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r31); const ctx_r30 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2); return ctx_r30.more(); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "mat-icon", 27);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "more_horiz");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("color", "primary");
} }
function MsPanel_ng_container_2_button_6_Template(rf, ctx) { if (rf & 1) {
    const _r33 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "button", 30);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function MsPanel_ng_container_2_button_6_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r33); const ctx_r32 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2); return ctx_r32.select(); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "mat-icon", 27);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r6 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("color", ctx_r6.selected ? "warn" : "primary");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](ctx_r6.selected ? "radio_button_checked" : "radio_button_unchecked");
} }
function MsPanel_ng_container_2_button_7_Template(rf, ctx) { if (rf & 1) {
    const _r35 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "button", 31);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function MsPanel_ng_container_2_button_7_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r35); const ctx_r34 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2); return ctx_r34.remove(); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "mat-icon", 27);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2, "highlight_off");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r7 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("color", ctx_r7.removable ? "warn" : "primary");
} }
function MsPanel_ng_container_2_mat_icon_9_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "mat-icon", 27);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1, "unfold_more");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} }
function MsPanel_ng_container_2_mat_icon_10_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "mat-icon", 27);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](1, "unfold_less");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} }
const _c2 = function (a0, a1) { return { "panel_large": a0, "panel_removable": a1 }; };
function MsPanel_ng_container_2_Template(rf, ctx) { if (rf & 1) {
    const _r37 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerStart"](0, 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "div", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](2, MsPanel_ng_container_2_ng_container_2_Template, 7, 5, "ng-container", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](3, MsPanel_ng_container_2_ng_container_3_Template, 5, 4, "ng-container", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](4, MsPanel_ng_container_2_button_4_Template, 4, 2, "button", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](5, MsPanel_ng_container_2_button_5_Template, 3, 1, "button", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](6, MsPanel_ng_container_2_button_6_Template, 3, 2, "button", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](7, MsPanel_ng_container_2_button_7_Template, 3, 1, "button", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](8, "button", 9);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("click", function MsPanel_ng_container_2_Template_button_click_8_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵrestoreView"](_r37); const ctx_r36 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](); return ctx_r36.enlarge(!ctx_r36.enlarged); });
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](9, MsPanel_ng_container_2_mat_icon_9_Template, 2, 0, "mat-icon", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](10, MsPanel_ng_container_2_mat_icon_10_Template, 2, 0, "mat-icon", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerEnd"]();
} if (rf & 2) {
    const ctx_r1 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngSwitch", ctx_r1.data.type);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction2"](10, _c2, ctx_r1.enlarged, ctx_r1.removable));
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngSwitchCase", "evt");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngSwitchCase", "img");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r1.data.rate !== undefined);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r1.data.actions !== undefined && ctx_r1.data.actions.length > 0 && !ctx_r1.enlarged);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx_r1.enlarged && ctx_r1.selectable);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx_r1.enlarged && ctx_r1.removable);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", !ctx_r1.enlarged);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r1.enlarged);
} }
const _c3 = function (a0) { return { "panel_highlighted": a0 }; };
/* changeDetection: ChangeDetectionStrategy.OnPush*/
class MsPanel {
    constructor(cd, dialog, router, menu, listService) {
        this.cd = cd;
        this.dialog = dialog;
        this.router = router;
        this.menu = menu;
        this.listService = listService;
        this.msSelect = new rxjs__WEBPACK_IMPORTED_MODULE_1__["Subject"]();
        this.msRate = new rxjs__WEBPACK_IMPORTED_MODULE_1__["Subject"]();
        this.msEnlarge = new rxjs__WEBPACK_IMPORTED_MODULE_1__["Subject"]();
        this.msRemove = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this.currentIdx = 0;
        this.focused = false;
        this.selected = false;
        this.enlarged = false;
        this.rated = false;
    }
    ngOnInit() {
        this.actionable = true;
    }
    slide(idx) {
        this.currentIdx = idx;
    }
    content(type) {
        if (this.data.children && this.data.url) {
            if (this.data.url.indexOf('templates') !== -1) {
                this.listService.dialog.emit({ itemUrl: this.data.url });
            }
            else {
                this.router.navigate([this.data.url]);
            }
        }
    }
    more() {
        this.menu.open(_ms_action__WEBPACK_IMPORTED_MODULE_2__["MsAction"], {
            data: {
                alias: this.alias,
                actions: this.data.actions,
                chat: this.data.chat,
                positions: this.data.positions,
            },
        });
    }
    onEnter(alias, msg) {
        this.alias = alias;
        // default load
        if (msg) {
            this.data = msg;
            this.cd.markForCheck();
        }
    }
    enlarge(isEnlarge) {
        if (this.data.rate !== undefined) {
            this.rate(isEnlarge && this.rated);
        }
        this.msEnlarge.next({
            pos: this.elementView.nativeElement.getBoundingClientRect(),
            alias: this.alias,
            enlarged: isEnlarge,
            rated: this.rated,
        });
    }
    rate(isAlways = false) {
        this.rated = true;
        this.cd.markForCheck();
        this.msRate.next({
            rate: this.data.rate,
            alias: this.alias,
            always: isAlways,
        });
    }
    remove() {
        this.msRemove.emit(this.alias);
    }
    select() {
        this.selected = true;
        this.cd.markForCheck();
        this.msSelect.next({ alias: this.alias });
    }
    focus(isFocused, isRated = false, isSelected = false) {
        this.focused = isFocused;
        if (isFocused === false && !isRated && !isSelected) {
            this.rated = false;
            this.selected = false;
        }
        else {
            this.rated = isRated;
            this.selected = isSelected;
        }
        this.cd.markForCheck();
    }
    update(rate) {
        if (this.data) {
            this.data.rate = rate;
            this.cd.markForCheck();
        }
    }
    show(isShow, isEnlarged = false) {
        this.visible = isShow;
        this.enlarged = isEnlarged;
        this.cd.markForCheck();
    }
    onLeave() { }
    ngOnDestroy() { }
}
MsPanel.ɵfac = function MsPanel_Factory(t) { return new (t || MsPanel)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_0__["ChangeDetectorRef"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_material_dialog__WEBPACK_IMPORTED_MODULE_3__["MatDialog"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_router__WEBPACK_IMPORTED_MODULE_4__["Router"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_material_bottom_sheet__WEBPACK_IMPORTED_MODULE_5__["MatBottomSheet"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](src_app_services_list_service__WEBPACK_IMPORTED_MODULE_6__["ListService"])); };
MsPanel.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: MsPanel, selectors: [["ms-panel"]], viewQuery: function MsPanel_Query(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c0, 1);
    } if (rf & 2) {
        let _t;
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.elementView = _t.first);
    } }, inputs: { alias: "alias", data: "data", visible: "visible", removable: "removable", selectable: "selectable", actionable: "actionable" }, outputs: { msRemove: "msRemove" }, decls: 3, vars: 5, consts: [[1, "panel", 3, "id", "ngClass"], ["panel", ""], [3, "ngSwitch", 4, "ngIf"], [3, "ngSwitch"], [1, "panel_content", "panel_default", 3, "ngClass"], [4, "ngSwitchCase"], ["mat-icon-button", "", "class", "panel_icon_top", 3, "color", "click", 4, "ngIf"], ["mat-icon-button", "", "class", "panel_icon_middle", 3, "color", "click", 4, "ngIf"], ["mat-icon-button", "", "class", "panel_icon_middle_left", 3, "color", "click", 4, "ngIf"], ["mat-icon-button", "", 1, "panel_icon_tf", 3, "click"], ["fontSet", "material-icons-outlined", 4, "ngIf"], ["matRipple", "", 3, "click"], [4, "ngIf"], ["matRipple", "", "class", "img_content", 3, "src", "click", 4, "ngIf"], ["class", "slide_bar", 4, "ngIf"], ["class", "panel_header_main", 3, "background", 4, "ngIf"], ["class", "panel_header_sub", 4, "ngIf"], ["matRipple", "", 1, "img_content", 3, "src", "click"], [1, "slide_bar"], ["class", "slide", 3, "click", 4, "ngFor", "ngForOf"], [1, "slide", 3, "click"], [1, "slide_anchor", 3, "ngClass"], [1, "panel_header_main"], [1, "panel_header_sub"], ["style", "float: right; height: 2vmax;", 4, "ngIf"], [2, "float", "right", "height", "2vmax"], ["mat-icon-button", "", 1, "panel_icon_top", 3, "color", "click"], ["fontSet", "material-icons-outlined"], ["class", "btn_label", 4, "ngIf"], [1, "btn_label"], ["mat-icon-button", "", 1, "panel_icon_middle", 3, "color", "click"], ["mat-icon-button", "", 1, "panel_icon_middle_left", 3, "color", "click"]], template: function MsPanel_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 0, 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](2, MsPanel_ng_container_2_Template, 11, 13, "ng-container", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("id", ctx.alias)("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction1"](3, _c3, ctx.focused));
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx.data);
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_7__["NgClass"], _angular_common__WEBPACK_IMPORTED_MODULE_7__["NgIf"], _angular_common__WEBPACK_IMPORTED_MODULE_7__["NgSwitch"], _angular_common__WEBPACK_IMPORTED_MODULE_7__["NgSwitchCase"], _angular_material_button__WEBPACK_IMPORTED_MODULE_8__["MatButton"], _angular_material_card__WEBPACK_IMPORTED_MODULE_9__["MatCard"], _angular_material_core__WEBPACK_IMPORTED_MODULE_10__["MatRipple"], _angular_material_card__WEBPACK_IMPORTED_MODULE_9__["MatCardContent"], _angular_material_card__WEBPACK_IMPORTED_MODULE_9__["MatCardHeader"], _angular_material_card__WEBPACK_IMPORTED_MODULE_9__["MatCardTitle"], _angular_material_card__WEBPACK_IMPORTED_MODULE_9__["MatCardSubtitle"], _angular_material_card__WEBPACK_IMPORTED_MODULE_9__["MatCardFooter"], _angular_common__WEBPACK_IMPORTED_MODULE_7__["NgForOf"], _angular_material_icon__WEBPACK_IMPORTED_MODULE_11__["MatIcon"]], encapsulation: 2, changeDetection: 0 });


/***/ }),

/***/ 0:
/*!***************************!*\
  !*** multi ./src/main.ts ***!
  \***************************/
/*! no static exports found */
/***/ (function(module, exports, __webpack_require__) {

module.exports = __webpack_require__(/*! /home/raxim/workspace/myscoutee/frontend/src/main.ts */"zUnb");


/***/ }),

/***/ "14Zu":
/*!**********************************************!*\
  !*** ./src/lib/ms-list/ms-calendar/utils.ts ***!
  \**********************************************/
/*! exports provided: monthlyTable */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "monthlyTable", function() { return monthlyTable; });
function monthlyTable(jsDate, data) {
    let from = new Date(jsDate.getFullYear(), jsDate.getMonth(), 1);
    let to = new Date(jsDate.getFullYear(), jsDate.getMonth() + 1, 0);
    let fromDayIdx = from.getDay() || 7;
    let toDayIdx = to.getDay() || 7;
    let weekNum = Math.ceil((fromDayIdx - 1 + to.getDate()) / 7);
    let rows = new Array();
    let dayNum = 1;
    for (let i = 0; i < weekNum; i++) {
        rows[i] = new Array();
        if (i === 0) {
            for (let j = fromDayIdx - 1; j < 7; j++) {
                let day = new Date(from.getFullYear(), from.getMonth(), dayNum);
                rows[i][j] = { title: dayNum, date: day.getTime() };
                if (data) {
                    rows[i][j].value = data[day.getTime()];
                }
                dayNum++;
            }
        }
        else if (i === weekNum - 1) {
            for (let j = 0; j < toDayIdx; j++) {
                let day = new Date(from.getFullYear(), from.getMonth(), dayNum);
                rows[i][j] = { title: dayNum, date: day.getTime() };
                if (data) {
                    rows[i][j].value = data[day.getTime()];
                }
                dayNum++;
            }
            for (let j = toDayIdx; j < 7; j++) {
                rows[i][j] = undefined;
            }
        }
        else {
            for (let j = 0; j < 7; j++) {
                let day = new Date(from.getFullYear(), from.getMonth(), dayNum);
                rows[i][j] = { title: dayNum, date: day.getTime() };
                if (data) {
                    rows[i][j].value = data[day.getTime()];
                }
                dayNum++;
            }
        }
    }
    return rows;
}


/***/ }),

/***/ "2NUr":
/*!***************************************!*\
  !*** ./src/app/navigation.service.ts ***!
  \***************************************/
/*! exports provided: NavigationService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "NavigationService", function() { return NavigationService; });
/* harmony import */ var rxjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! rxjs */ "qCKp");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/core */ "fXoL");


class NavigationService {
    constructor() {
        this._reset = new rxjs__WEBPACK_IMPORTED_MODULE_0__["Subject"]();
        this._online = new rxjs__WEBPACK_IMPORTED_MODULE_0__["BehaviorSubject"]({ online: true });
        this._server = new rxjs__WEBPACK_IMPORTED_MODULE_0__["Subject"]();
        this._msg = new Array();
    }
    get xlink() {
        return this._xlink;
    }
    set xlink(xlink) {
        this._xlink = xlink;
    }
    get reset() {
        return this._reset;
    }
    get online() {
        return this._online;
    }
    get server() {
        return this._server;
    }
    get token() {
        return this._token;
    }
    set token(token) {
        this._token = token;
    }
    get prevUrl() {
        return this._prevUrl;
    }
    set prevUrl(prevUrl) {
        this._prevUrl = prevUrl;
    }
    get selected() {
        return this._selected;
    }
    set selected(selected) {
        this._selected = selected;
    }
    get pos() {
        return this._pos;
    }
    set pos(pos) {
        this._pos = pos;
    }
    get groupName() {
        return this._groupName;
    }
    set groupName(groupName) {
        this._groupName = groupName;
    }
    get groupType() {
        return this._groupType;
    }
    set groupType(groupType) {
        this._groupType = groupType;
    }
    get notif() {
        return this._notif;
    }
    set notif(notif) {
        this._notif = notif;
    }
    get profileId() {
        return this._profileId;
    }
    set profileId(profileId) {
        this._profileId = profileId;
    }
    addMsg(route, msg) {
        if (this._msg[route] === undefined) {
            this._msg[route] = new Array();
        }
        this._msg[route].push(msg);
    }
    getMsg(route) {
        return this._msg[route];
    }
    get locale() {
        return this._locale;
    }
    set locale(msg) {
        this._locale = msg;
    }
}
NavigationService.ɵfac = function NavigationService_Factory(t) { return new (t || NavigationService)(); };
NavigationService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineInjectable"]({ token: NavigationService, factory: NavigationService.ɵfac, providedIn: 'root' });


/***/ }),

/***/ "2qPP":
/*!**************************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/repositories/interpolate.ts ***!
  \**************************************************************/
/*! exports provided: Interpolate */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Interpolate", function() { return Interpolate; });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils */ "kVHy");

//https://github.com/rveciana/svg-path-properties/
class Interpolate {
    constructor(path) {
        this.path = path;
    }
    nearby(idx, point, bound) {
        let pathLength = this.path.getTotalLength();
        var precision = 8, best, bestLength, bestDistance = Infinity;
        // linear scan for coarse approximation
        for (var scan, scanLength = 0, scanDistance; scanLength <= pathLength; scanLength += precision) {
            if ((scanDistance = _utils__WEBPACK_IMPORTED_MODULE_0__["Calc"].distance2(scan = this.path.getPointAtLength(scanLength), point)) < bestDistance) {
                best = scan, bestLength = scanLength, bestDistance = scanDistance;
            }
        }
        // binary search for precise estimate
        precision /= 2;
        while (precision > 0.5) {
            var before, after, beforeLength, afterLength, beforeDistance, afterDistance;
            if ((beforeLength = bestLength - precision) >= 0 && (beforeDistance = _utils__WEBPACK_IMPORTED_MODULE_0__["Calc"].distance2(before = this.path.getPointAtLength(beforeLength), point)) < bestDistance) {
                best = before, bestLength = beforeLength, bestDistance = beforeDistance;
            }
            else if ((afterLength = bestLength + precision) <= pathLength && (afterDistance = _utils__WEBPACK_IMPORTED_MODULE_0__["Calc"].distance2(after = this.path.getPointAtLength(afterLength), point)) < bestDistance) {
                best = after, bestLength = afterLength, bestDistance = afterDistance;
            }
            else {
                precision /= 2;
            }
        }
        var len2 = bestLength + (bestLength === pathLength ? -0.1 : 0.1);
        var rotation = _utils__WEBPACK_IMPORTED_MODULE_0__["Calc"].getRotation(best, this.path.getPointAtLength(len2));
        return {
            point: best,
            rotation: rotation * _utils__WEBPACK_IMPORTED_MODULE_0__["DEG"],
        };
    }
}


/***/ }),

/***/ "38kq":
/*!******************************!*\
  !*** ./src/app/animation.ts ***!
  \******************************/
/*! exports provided: slideInAnimation */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "slideInAnimation", function() { return slideInAnimation; });
/* harmony import */ var _angular_animations__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/animations */ "R0Ic");

const slideInAnimation = Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["trigger"])('routeAnimations', [
    Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["transition"])('One1 => One, Two1 => Two, Three1 => Three, Three2 => Three1, * => Four', [
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ position: 'relative' }),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter .mat-fab-container', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({
            opacity: 0,
            position: 'fixed'
        })),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':leave .mat-fab-container', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({
            opacity: 1,
            position: 'fixed'
        })),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter, :leave', [
            Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
            }),
        ]),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter', [Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ left: '-100%' })]),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':leave', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animateChild"])()),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["group"])([
            Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':leave', [Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animate"])('300ms ease-out', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ left: '100%' }))]),
            Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter', [Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animate"])('300ms ease-out', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ left: '0%' }))]),
            Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter .mat-fab-container', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animate"])(300, Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ opacity: 1 }))),
            Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':leave .mat-fab-container', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animate"])(300, Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ opacity: 0 }))),
        ]),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animateChild"])()),
    ]),
    Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["transition"])('One => One1, Two => Two1, Three => Three1, Three1 => Three2, Four => *', [
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ position: 'relative' }),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter .mat-fab-container', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({
            opacity: 0,
            position: 'fixed'
        })),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':leave .mat-fab-container', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({
            opacity: 1,
            position: 'fixed'
        })),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter, :leave', [
            Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
            }),
        ]),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter', [Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ left: '100%' })]),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':leave', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animateChild"])()),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["group"])([
            Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':leave', [Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animate"])('200ms ease-out', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ left: '-100%' }))]),
            Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter', [Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animate"])('300ms ease-out', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ left: '0%' }))]),
            Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter .mat-fab-container', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animate"])(300, Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ opacity: 1 }))),
            Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':leave .mat-fab-container', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animate"])(300, Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["style"])({ opacity: 0 }))),
        ]),
        Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["query"])(':enter', Object(_angular_animations__WEBPACK_IMPORTED_MODULE_0__["animateChild"])()),
    ]),
]);


/***/ }),

/***/ "3d5Q":
/*!****************************************!*\
  !*** ./src/lib/ms-editor/magnifier.ts ***!
  \****************************************/
/*! exports provided: Transform, Magnifier */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Transform", function() { return Transform; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Magnifier", function() { return Magnifier; });
class Transform {
    constructor(mtx = { scale: 1, angle: 0, pos: { x: 0, y: 0 } }) {
        this._mtx = mtx;
    }
    scale(uiScale) {
        this._mtx.scale += uiScale;
        return this._mtx;
    }
    move(uiDiff) {
        this._mtx.pos.x += uiDiff.x;
        this._mtx.pos.y += uiDiff.y;
        return this._mtx;
    }
    rotate(deg) {
        this._mtx.angle += deg;
        return this._mtx;
    }
    get mtx() {
        return this._mtx;
    }
}
//tab/canvas zoom
class Magnifier {
    constructor(element, _renderer, _transform) {
        this.element = element;
        this._renderer = _renderer;
        this._transform = _transform;
        this.touches = new Array();
    }
    listen(_callback) {
        this._renderer.listen(this.element, 'mousewheel', (event) => {
            event.preventDefault();
            let uiScale = Math.sign(event.wheelDelta) * 0.1;
            let uiOrigin = {
                x: event.pageX - this.element.offsetLeft,
                y: event.pageY - this.element.offsetTop,
            };
            let tr = this._transform.scale(uiScale);
            _callback(tr);
        });
        this._renderer.listen(this.element, 'touchstart', (event) => {
            this.updateTouch(event);
            if (this.touches[0] && this.touches[1]) {
            }
            else if (this.touches[0] || this.touches[1]) {
                let touch = event.targetTouches[0];
                if (this.dragStart === undefined) {
                    this.dragStart = {
                        x: touch.pageX - this.element.offsetLeft,
                        y: touch.pageY - this.element.offsetTop,
                    };
                }
            }
        });
        this._renderer.listen(this.element, 'touchmove', (event) => {
            this.updateTouch(event);
            if (this.touches[0] && this.touches[1]) {
                let touch1 = this.touches[0];
                let touch2 = this.touches[1];
                let start;
                let end;
                if (touch1.pageX >= touch2.pageX) {
                    start = touch1;
                    end = touch2;
                }
                else {
                    start = touch2;
                    end = touch1;
                }
                let diff = { x: end.pageX - start.pageX, y: end.pageY - start.pageY };
                let dist = Math.sqrt(diff.x * diff.x + diff.y * diff.y);
                if (this.dist === undefined) {
                    this.dist = dist;
                }
                let uiScale = dist / this.dist - 1;
                this.dist = dist;
                let tr = this._transform.scale(uiScale);
                _callback(tr);
            }
            else if (this.touches[0] || this.touches[1]) {
                let touch = this.touches[0] || this.touches[1];
                if (this.dragStart !== undefined) {
                    let dragEnd = {
                        x: touch.pageX - this.element.offsetLeft,
                        y: touch.pageY - this.element.offsetTop,
                    };
                    let uiDiff = {
                        x: dragEnd.x - this.dragStart.x,
                        y: dragEnd.y - this.dragStart.y,
                    };
                    this.dragStart = dragEnd;
                    let tr = this._transform.move(uiDiff);
                    _callback(tr);
                }
            }
        });
        this._renderer.listen(this.element, 'touchend', (event) => {
            for (let touch of event.changedTouches) {
                delete this.touches[touch.identifier];
            }
            if (this.touches[0] || this.touches[1]) {
                let touch = this.touches[0] || this.touches[1];
                this.dragStart = {
                    x: touch.pageX - this.element.offsetLeft,
                    y: touch.pageY - this.element.offsetTop,
                };
            }
            else {
                this.dragStart = undefined;
            }
            this.dist = undefined;
        });
    }
    rotate(deg) {
        return this._transform.rotate(deg);
    }
    updateTouch(event) {
        if (event.targetTouches.length === 1) {
            this.touches[event.targetTouches[0].identifier] = event.targetTouches[0];
        }
        if (event.targetTouches.length === 2) {
            this.touches[event.targetTouches[1].identifier] = event.targetTouches[1];
        }
    }
    get transform() {
        return this._transform;
    }
}


/***/ }),

/***/ "46oZ":
/*!***********************************************!*\
  !*** ./src/app/services/transform.service.ts ***!
  \***********************************************/
/*! exports provided: TransformService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "TransformService", function() { return TransformService; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/common */ "ofXK");


const physiques = { s: 'Slim', a: 'Average', sp: 'Sum plus', m: 'Muscular' };
class TransformService {
    constructor(datePipe) {
        this.datePipe = datePipe;
    }
    transform(value, url, inList = false, refresh = false, table = false) {
        // for mixed type of list, we need to identify profile
        /*if (value['_links']) {
          const url = value['_links'].self.href;
          value['key'] = url.substr(url.lastIndexOf('/') + 1);
        }
    
        const id = value['key'] !== undefined ? value['key'] : value['id'];
    
        if (id === undefined) {
          return;
        }*/
        let data;
        if (value !== undefined) {
            if (value['profile'] !== undefined) {
                this.alignItemZone(value['profile']);
                value['profile'].role = value['role'];
                data = this.transformProfile(value['profile'].key, value['profile'], url, inList, refresh, value);
            }
            else if (value['car'] !== undefined) {
                this.alignItemZone(value['car']);
                data = this.transformCar(value['car'].key, value['car'], url, inList);
            }
            else if (value['school'] !== undefined) {
                this.alignItemZone(value['school']);
                data = this.transformSchool(value['school'].key, value['school'], url, inList);
            }
            else if (value['event'] !== undefined) {
                this.alignItemZone(value['event'].info);
                data = this.transformEvent(value['event'].key, value['event'], url, inList, table, value);
            }
            else if (value['item'] !== undefined) {
                this.alignItemZone(value['item']);
                data = this.transformEventItem(value['item'].key, value['item'], url, inList, value);
            }
            else if (value['feedback'] !== undefined) {
                this.alignItemZone(value['feedback']);
                data = this.transformFeedback(value['feedback'].key, value['feedback'], url, inList);
            }
            else if (value['member'] !== undefined) {
                this.alignItemZone(value['member']);
                data = this.transformMember(value['member'].key, value['member'], url, inList);
            }
            else if (value['job'] !== undefined) {
                this.alignItemZone(value['job']);
                data = this.transformJob(value['job'].key, value['job'], url, inList);
            }
            else if (value['idea'] !== undefined) {
                this.alignItemZone(value['idea']);
                data = this.transformIdea(value['idea'].key, value['idea'], url, inList);
            }
            else if (value['group'] !== undefined) {
                this.alignItemZone(value['group']);
                data = this.transformGroup(value['group'].key, value['group'], url, inList);
            }
            else if (value['promotion'] !== undefined) {
                this.alignItemZone(value['promotion']);
                data = this.transformPromotion(value['promotion'].key, value['promotion'], url, inList);
            }
            this.alignZone(value);
            data.sortKey = value.sortKey;
            data.groupKey = value.groupKey;
            data.rate = value.rate;
            data.role = value.role;
            return data;
        }
    }
    alignZone(value) {
        if (value !== undefined) {
            value['sortKey'] = this.shiftWithTimeZone(value['sortKey']);
            if (value['groupKey'] !== undefined &&
                !Number.isInteger(value['groupKey'])) {
                const oldLength = value['groupKey'].length;
                value['groupKey'] = this.shiftWithTimeZone(value['groupKey']).substring(0, oldLength);
            }
        }
    }
    alignItemZone(value) {
        if (value !== undefined) {
            value['createdDate'] = this.shiftWithTimeZone(value['createdDate']);
            if (value['range'] !== undefined) {
                value['range'].start = this.shiftWithTimeZone(value['range'].start);
                value['range'].end = this.shiftWithTimeZone(value['range'].end);
            }
            if (value['slots'] !== undefined) {
                value['slots'].map((slot) => {
                    if (slot['range'] !== undefined) {
                        slot['range'].start = this.shiftWithTimeZone(slot['range'].start);
                        slot['range'].end = this.shiftWithTimeZone(slot['range'].end);
                    }
                    return slot;
                });
            }
        }
    }
    shiftWithTimeZone(date) {
        if (date === undefined) {
            return date;
        }
        const start = new Date(date);
        if (isNaN(start.getTime())) {
            return date;
        }
        else {
            const offset = start.getTimezoneOffset() * 60000;
            return new Date(start.getTime() - offset).toISOString();
        }
    }
    transformGroup(id, value, url, inList) {
        let actions = ['E', 'S']; // edit
        if (url.indexOf('recommendations') !== -1) {
            actions = ['J'];
        }
        let itemUrl = url.substring(1);
        itemUrl = itemUrl.substring(itemUrl.indexOf('/'));
        const data = {
            id,
            type: 'evt',
            state: 'E',
            header: { main: value['name'] },
            desc: value['desc'],
            actions,
            imgs: (value['images'] !== undefined
                ? value['images']
                : []).map((image) => location.origin +
                '/backend' +
                itemUrl +
                (inList ? '/' + id : '') +
                '/images/' +
                image['name']),
            children: url.indexOf('recommendations') === -1,
            value,
            url: url + '/' + id,
        };
        return data;
    }
    transformIdea(id, value, url, inList) {
        const actions = ['E']; // edit
        const data = {
            id,
            type: 'evt',
            state: 'E',
            header: { main: value['name'] },
            desc: value['desc'],
            actions,
            value,
            url: url + '/' + id,
        };
        return data;
    }
    transformJob(id, value, url, inList) {
        const actions = ['E']; // edit
        const data = {
            id,
            type: 'evt',
            state: 'E',
            header: { main: value['name'] },
            desc: value['desc'],
            actions,
            value,
            url: url + '/' + id,
        };
        return data;
    }
    transformFeedback(id, value, url, inList) {
        const actions = ['E']; // edit
        const data = {
            id,
            type: 'evt',
            state: 'E',
            color: value['rate'] < 3
                ? 'red'
                : value['rate'] > 7
                    ? 'yellowgreen'
                    : 'bisque',
            desc: value['desc'],
            value,
            url: url + '/' + id,
            actions,
        };
        return data;
    }
    transformEventItem(id, value, url, inList, param) {
        let state = 'E';
        let actions = []; // edit
        const main = param && param['main'] === true;
        let isPromotion = param && param['isPromotion'] === true;
        let isMember = param && param['isMember'] === true;
        let role = param && param['role'];
        if (main) {
            actions = ['E']; // edit
        }
        else {
            actions = ['E', 'D']; // edit
        }
        let children = false;
        if (url) {
            if (url.indexOf('invitations') !== -1) {
                state = 'I';
                actions = [];
            }
            else if (url.indexOf('recommendations') !== -1) {
                actions = [];
            }
            else if (url.indexOf('promotions') !== -1) {
                if (url.indexOf('activity') !== -1) {
                    actions = [];
                }
            }
            else if (url.indexOf('activity') !== -1) {
                if (url.indexOf('events') !== -1) {
                    if (value['optional'] === true) {
                        if ((isPromotion && role === 'P') ||
                            (!isPromotion && role === 'M')) {
                            actions = ['E', 'D']; // edit
                        }
                        if (isMember && (role === 'U' || role === 'M')) {
                            actions.push('L');
                        }
                        else {
                            actions.push('J');
                        }
                        children = true;
                    }
                }
            }
        }
        let color = 'cornsilk';
        if (value['type'] === 'g') {
            color = 'yellowgreen';
        }
        else if (value['type'] === 'c') {
            color = 'aliceblue';
        }
        if (value['optional'] === true) {
            color = 'pink';
            if (value['num'] === value['capacity'].max) {
                color = 'gray';
            }
            else if (value['num'] < value['capacity'].min) {
                color = 'red';
            }
        }
        if (main) {
            color = 'coral';
        }
        const category = param && param['category'];
        const positions = value['positions'] && value['positions']
            ? value['positions']
            : param && param['positions']
                ? param['positions']
                : value['position']
                    ? [value['position']]
                    : undefined;
        if (positions !== undefined) {
            actions.push('M');
        }
        const data = {
            id,
            type: 'evt',
            state,
            header: { main: value.name },
            actions,
            value,
            desc: value.desc,
            url: url + '/' + id,
            color,
            children,
            extra: {
                main,
                category,
            },
            positions,
            num: value.num,
        };
        return data;
    }
    transformEvent(id, value, url, inList, table, param) {
        const info = value['info'];
        let isPromotion = param && param['isPromotion'] === true;
        let role = param && param['role'];
        let state = 'E';
        let actions = []; // leave, edit, qr code
        if (url) {
            if (url.indexOf('invitations') !== -1) {
                state = 'I';
                if (info['num'] === info['capacity'].max) {
                    actions = ['W', 'R']; // waiting, reject
                }
                else {
                    actions = ['A', 'R']; // accept, reject
                }
            }
            else if (url.indexOf('recommendations') !== -1) {
                if (url.indexOf('events') !== -1) {
                    if (param &&
                        param['groupType'] === 'd' &&
                        param['promoType'] === 'e') {
                        actions = ['C'];
                        // nasty hack
                        param['rate'] = undefined;
                    }
                }
                else {
                    actions = [];
                }
            }
            else if (url.indexOf('promotions') !== -1) {
                if (url.indexOf('activity') !== -1) {
                    if (url.indexOf('business') !== -1) {
                        if (info['num'] === info['capacity'].max) {
                            actions = ['W', 'R']; // waiting, reject
                        }
                        else {
                            actions = ['A', 'R']; // accept, reject
                        }
                    }
                    else {
                        actions = [];
                    }
                }
                else {
                    actions = ['E']; // edit
                }
            }
            else if (url.indexOf('activity') !== -1) {
                if (url.indexOf('business') === -1) {
                    if ((isPromotion && role === 'P') || (!isPromotion && role === 'M')) {
                        actions = ['E']; // edit
                    }
                    actions.push('L', 'Q', 'CH', 'U');
                }
                else {
                    actions = ['CA', 'Q', 'CH'];
                }
            }
            else if (url.indexOf('groups') !== -1) {
                actions = ['P', 'R'];
            }
        }
        let color = 'aliceblue';
        if (value['status'] === 'P') {
            color = 'orange';
        }
        else if (value['status'] === 'C') {
            color = 'darkgrey';
        }
        else if (value['status'] === 'A') {
            if (isPromotion) {
                color = 'pink';
            }
        }
        if (info['num'] === info['capacity'].max) {
            color = 'gray';
        }
        else if (info['num'] < info['capacity'].min) {
            color = 'red';
        }
        const positions = value['positions'] && value['positions']
            ? value['positions']
            : param && param['positions']
                ? param['positions']
                : value['position']
                    ? [value['position']]
                    : undefined;
        if (positions !== undefined) {
            actions.push('M');
        }
        let data;
        if (table !== true) {
            data = {
                id,
                type: 'evt',
                createdBy: value.createdBy,
                state,
                header: { main: info ? info.name : '' },
                actions,
                value: info,
                desc: info ? info.desc : '',
                url: url ? url + '/' + id : undefined,
                children: true,
                color,
                chat: info ? info.chatKey : undefined,
                name: info ? info.name : undefined,
                isPromotion,
                positions,
                num: info ? info.num : 0,
            };
        }
        else {
            data = {
                id,
                title: info.name,
                range: info.range,
                color,
                name: info ? info.name : undefined,
                isPromotion,
                num: info ? info.num : 0,
            };
        }
        return data;
    }
    transformPromotion(id, value, url, inList) {
        const state = 'E';
        let actions = ['E']; // edit
        if (url.indexOf('recommendations') !== -1) {
            actions = [];
        }
        const data = {
            id,
            type: 'evt',
            state,
            header: { main: value.name },
            actions,
            value,
            desc: value.desc,
            url: url + '/' + id,
            footer: this.datePipe.transform(value['range'].start, 'dd/MMM/y') +
                ' - ' +
                this.datePipe.transform(value['range'].end, 'dd/MMM/y'),
            children: true,
            color: 'lightpink',
        };
        return data;
    }
    transformSchool(id, value, url, inList) {
        const actions = ['E', 'D']; // edit
        const data = {
            id,
            type: 'evt',
            state: 'E',
            header: { main: value['name'] },
            color: value['type'] === 'w' ? 'aliceblue' : 'beige',
            desc: value['role'],
            actions,
            value,
            url: url + '/' + id,
            footer: this.datePipe.transform(value['range'].start, 'MMM/y') +
                ' - ' +
                this.datePipe.transform(value['range'].end, 'MMM/y'),
        };
        return data;
    }
    transformCar(id, value, url, inList) {
        const actions = ['E', 'D']; // edit
        let itemUrl = url.substring(1);
        itemUrl = itemUrl.substring(itemUrl.indexOf('/'));
        const data = {
            id,
            type: 'img',
            state: 'E',
            header: {
                main: value['make'] +
                    ' ' +
                    value['model'] +
                    ' (' +
                    value['capacity'] +
                    ') ',
                sub: value['regNum'],
            },
            imgs: (value['images'] !== undefined
                ? value['images']
                : []).map((image) => location.origin +
                '/backend' +
                itemUrl +
                (inList ? '/' + id : '') +
                '/images/' +
                image['name']),
            value,
            url: url + '/' + id,
            actions,
        };
        return data;
    }
    transformMember(id, member, url, inList) {
        const value = member['profile'];
        let itemUrl = url.substring(1);
        itemUrl = itemUrl.substring(itemUrl.indexOf('/'));
        const age = Math.floor((new Date().getTime() - new Date(value['birthday']).getTime()) /
            (1000 * 3600 * 24 * 365));
        let color;
        switch (member['status']) {
            case 'F':
                color = 'orange';
                break;
            case 'I':
                color = 'gray';
                break;
            case 'P':
                color = 'black';
                break;
            case 'S':
                color = 'red';
                break;
            default:
                color = 'green';
        }
        // header main
        let main;
        if (value['firstName'] !== undefined) {
            main = value['firstName'] + ' (' + age + ' / ' + value['height'] + 'cm)';
        }
        // header sub
        let sub = '';
        if (value['physique'] !== undefined) {
            if (value['physique'] !== 'a') {
                sub += physiques[value['physique']];
            }
        }
        if (value['smoker'] === true) {
            sub += ' \uD83D\uDEAD';
        }
        if (value['hasChild'] === true) {
            sub += ' \uD83D\uDC76';
        }
        const data = {
            id,
            type: 'img',
            state: 'E',
            header: {
                main,
                sub,
            },
            imgs: (value['images'] !== undefined
                ? value['images']
                : []).map((image) => location.origin +
                '/backend' +
                itemUrl +
                (inList ? '/' + id : '') +
                '/images/' +
                image['name']),
            value,
            url: url + '/' + id,
            rate: 0,
            color,
        };
        return data;
    }
    transformProfile(id, value, url, inList, refresh, param) {
        const age = value['birthday'] !== undefined
            ? Math.floor((new Date().getTime() - new Date(value['birthday']).getTime()) /
                (1000 * 3600 * 24 * 365))
            : undefined;
        let actions;
        if (url.indexOf('groups') !== -1) {
            actions = ['E']; // edit
        }
        let itemUrl = url.substring(1);
        itemUrl = itemUrl.substring(itemUrl.indexOf('/'));
        let icon = 'person';
        if (value['role'] === 'ROLE_ADMIN') {
            icon = 'engineering';
        }
        let color;
        switch (value['status']) {
            case 'F':
                color = 'orange';
                break;
            case 'I':
                color = 'gray';
                break;
            case 'P':
                color = 'black';
                break;
            case 'S':
                color = 'red';
                break;
            default:
                color = 'green';
        }
        // header main
        let main;
        if (value['firstName'] !== undefined) {
            main =
                value['firstName'] +
                    (age !== undefined ? ' (' + age + ' / ' + value['height'] + 'cm)' : '');
        }
        // header sub
        let sub = '';
        if (value['physique'] !== undefined) {
            if (value['physique'] !== 'a') {
                sub += physiques[value['physique']];
            }
        }
        if (value['marital'] !== undefined) {
            if (value['marital'] === 't') {
                sub += ' \uD83D\uDC91';
            }
        }
        if (value['smoker'] === true) {
            sub += ' \uD83D\uDEAD';
        }
        if (value['hasChild'] === true) {
            sub += ' \uD83D\uDC76';
        }
        const imgs = (value['images'] !== undefined ? value['images'] : []).map((image) => location.origin +
            '/backend' +
            itemUrl +
            (inList ? '/' + value['key'] : '') +
            '/images/' +
            image['name'] +
            (refresh ? '?' + Date.now() : ''));
        if (imgs.length === 0) {
            imgs.push('../assets/img/man.svg');
        }
        let children = false;
        if (url && (url.indexOf('job') !== -1 || url.indexOf('business') !== -1)) {
            if (url.indexOf('activity') !== -1 && url.indexOf('events') !== -1) {
                children = true;
            }
            if (url.indexOf('games') !== -1) {
                children = true;
            }
            if (url.indexOf('recommendations') === -1 &&
                url.indexOf('promotions') !== -1) {
                children = true;
            }
        }
        const data = {
            id,
            name: value['firstName'],
            type: 'img',
            state: 'E',
            ref: param ? param['ref'] : undefined,
            role: { icon, color },
            header: {
                main,
                sub,
            },
            imgs,
            actions,
            value,
            url: url ? url + '/' + id : undefined,
            children,
        };
        return data;
    }
    uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
}
TransformService.ɵfac = function TransformService_Factory(t) { return new (t || TransformService)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵinject"](_angular_common__WEBPACK_IMPORTED_MODULE_1__["DatePipe"])); };
TransformService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: TransformService, factory: TransformService.ɵfac, providedIn: 'any' });


/***/ }),

/***/ "4lXa":
/*!****************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/svg-load/index.ts ***!
  \****************************************************/
/*! exports provided: SvgLoad */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "SvgLoad", function() { return SvgLoad; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");


const _c0 = ["container"];
const _c1 = ["svgObj"];
//http://www.petercollingridge.co.uk/tutorials/svg/interactive/javascript/
class SvgLoad {
    constructor(_renderer, sanitizer, cd) {
        this._renderer = _renderer;
        this.sanitizer = sanitizer;
        this.cd = cd;
        this.id = "path_123";
    }
    sanitize(url) {
        return this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }
    ngOnInit() {
        this.svg_url = "assets/img/heart.svg";
        this.rs_url = this.sanitize(this.svg_url);
        /*let xhr = new XMLHttpRequest();
        xhr.open("GET", this.svg_url);
        xhr.overrideMimeType("image/svg+xml");
        xhr.send("");

        xhr.onreadystatechange = () => {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    let doc = xhr.responseXML.documentElement;
                    this.appendStroke(doc);
                    this._renderer.appendChild(this.container.nativeElement, doc);
                }
            }
        }*/
    }
    onload(event) {
        let target = event === undefined ? {} : event.srcElement || event.target;
        this.appendStroke(target.contentDocument.documentElement);
    }
    appendStroke(doc) {
        let strokeWidth = 16;
        let linkNS = "http://www.w3.org/1999/xlink";
        let svgNS = "http://www.w3.org/2000/svg";
        let width = parseInt(doc.getAttribute("width"));
        let height = parseInt(doc.getAttribute("height"));
        doc.setAttribute("xmlns:xlink", linkNS);
        doc.setAttribute("width", "100%");
        doc.setAttribute("height", "100%");
        doc.setAttribute("viewBox", "0 0 " + (width + strokeWidth) + " " + height);
        doc.setAttribute("preserveAspectRatio", "none");
        let path = doc.getElementsByTagName("path")[0];
        if (path === undefined)
            return;
        path.setAttribute("fill", "none");
        path.setAttribute("id", this.id);
        let g = doc.getElementsByTagName("g")[0];
        g.setAttribute("transform", "translate(" + strokeWidth + " 0)");
        let usePath = document.createElementNS(svgNS, 'use');
        //href has different namespace in use
        usePath.setAttributeNS(linkNS, "xlink:href", "#" + this.id);
        usePath.setAttribute("stroke-width", "1");
        usePath.setAttribute("stroke", "black");
        g.append(usePath);
        usePath = document.createElementNS(svgNS, 'use');
        usePath.setAttributeNS(linkNS, "xlink:href", "#" + this.id);
        usePath.setAttribute("stroke-width", strokeWidth.toString());
        usePath.setAttribute("stroke", "#387ef5");
        usePath.setAttribute("stroke-dashoffset", "100");
        usePath.setAttribute("stroke-dasharray", "1790");
        g.append(usePath);
    }
}
SvgLoad.ɵfac = function SvgLoad_Factory(t) { return new (t || SvgLoad)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_0__["Renderer2"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_platform_browser__WEBPACK_IMPORTED_MODULE_1__["DomSanitizer"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_0__["ChangeDetectorRef"])); };
SvgLoad.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: SvgLoad, selectors: [["svg-load"]], viewQuery: function SvgLoad_Query(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c0, 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c1, 1);
    } if (rf & 2) {
        let _t;
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.container = _t.first);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.svgObjRef = _t.first);
    } }, decls: 4, vars: 1, consts: [[1, "svg_container"], ["container", ""], ["type", "image/svg+xml", 3, "data", "load"], ["svgObj", ""]], template: function SvgLoad_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "div", 0, 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](2, "object", 2, 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("load", function SvgLoad_Template_object_load_2_listener($event) { return ctx.onload($event); });
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("data", ctx.rs_url, _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵsanitizeResourceUrl"]);
    } }, encapsulation: 2 });


/***/ }),

/***/ "5nbR":
/*!***************************************!*\
  !*** ./src/app/auth-guard.service.ts ***!
  \***************************************/
/*! exports provided: AuthGuardService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AuthGuardService", function() { return AuthGuardService; });
/* harmony import */ var rxjs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! rxjs */ "qCKp");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _navigation_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./navigation.service */ "2NUr");
/* harmony import */ var _services_http_service__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./services/http.service */ "N+K7");
/* harmony import */ var _angular_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @angular/router */ "tyNb");





class AuthGuardService {
    constructor(navService, httpService, router) {
        this.navService = navService;
        this.httpService = httpService;
        this.router = router;
    }
    canLoad(route, segments) {
        return new rxjs__WEBPACK_IMPORTED_MODULE_0__["Observable"]((observer) => {
            if (this.navService.token === undefined) {
                observer.next(false);
                observer.complete();
            }
            else {
                observer.next(true);
                observer.complete();
            }
        });
    }
}
AuthGuardService.ɵfac = function AuthGuardService_Factory(t) { return new (t || AuthGuardService)(_angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵinject"](_navigation_service__WEBPACK_IMPORTED_MODULE_2__["NavigationService"]), _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵinject"](_services_http_service__WEBPACK_IMPORTED_MODULE_3__["HttpService"]), _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵinject"](_angular_router__WEBPACK_IMPORTED_MODULE_4__["Router"])); };
AuthGuardService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineInjectable"]({ token: AuthGuardService, factory: AuthGuardService.ɵfac, providedIn: 'root' });


/***/ }),

/***/ "AytR":
/*!*****************************************!*\
  !*** ./src/environments/environment.ts ***!
  \*****************************************/
/*! exports provided: environment */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "environment", function() { return environment; });
// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
const environment = {
    production: false,
    serverUrl: "http://localhost:8080/",
    firebase: {
        apiKey: 'AIzaSyA1zXvagfmEpGd8iN7NAgovCd11knGOYSs',
        authDomain: 'myscoutee.firebaseapp.com',
        projectId: 'myscoutee',
        storageBucket: 'myscoutee.appspot.com',
        messagingSenderId: '117896229531',
        appId: '1:117896229531:web:4edd7330be29c1e7404c3e',
    },
    vapid: 'BEqCwlbXuzTypczUuJRV7X8K2rNXDjEXLng95-vE0PeC_Fex5QR9upQMtU03jzG35_qUZQP-f1cBi5U_w-m1cm8',
    groupTypes: {
        d: 'dating',
        b: 'business',
        t: 'job',
        a: 'admin',
    }
};
/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.


/***/ }),

/***/ "BKi+":
/*!**********************************************!*\
  !*** ./src/lib/ms-list/ms-calendar/index.ts ***!
  \**********************************************/
/*! exports provided: MsCalendar */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MsCalendar", function() { return MsCalendar; });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils */ "14Zu");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _angular_material_core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/material/core */ "FKr1");




function MsCalendar_div_1_div_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "div", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
} if (rf & 2) {
    const day_r3 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtextInterpolate"](day_r3);
} }
function MsCalendar_div_1_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "div", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "div", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](2, MsCalendar_div_1_div_2_Template, 2, 1, "div", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r0 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngForOf", ctx_r0.days);
} }
function MsCalendar_div_2_div_1_div_1_div_1_div_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelement"](0, "div", 16);
} if (rf & 2) {
    const cell_r9 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵnextContext"](2).$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵstyleProp"]("background", cell_r9.value);
} }
function MsCalendar_div_2_div_1_div_1_div_1_div_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelement"](0, "div", 17);
} }
function MsCalendar_div_2_div_1_div_1_div_1_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "div");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](2, MsCalendar_div_2_div_1_div_1_div_1_div_2_Template, 1, 2, "div", 14);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](3, MsCalendar_div_2_div_1_div_1_div_1_div_3_Template, 1, 0, "div", 15);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
} if (rf & 2) {
    const cell_r9 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵnextContext"]().$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtextInterpolate1"](" ", cell_r9.title, " ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", cell_r9.value);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", !cell_r9.value);
} }
function MsCalendar_div_2_div_1_div_1_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "div", 12);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](1, MsCalendar_div_2_div_1_div_1_div_1_Template, 4, 3, "div", 13);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
} if (rf & 2) {
    const cell_r9 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", cell_r9);
} }
function MsCalendar_div_2_div_1_div_2_div_1_Template(rf, ctx) { if (rf & 1) {
    const _r18 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "div", 20);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵlistener"]("click", function MsCalendar_div_2_div_1_div_2_div_1_Template_div_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵrestoreView"](_r18); const item_r16 = ctx.$implicit; const ctx_r17 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵnextContext"](4); return ctx_r17.onCellClick(item_r16.id); });
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
} if (rf & 2) {
    const item_r16 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵstyleMap"]("--width:" + item_r16.cal.width + ";--pos:" + item_r16.cal.from + ";--color:" + item_r16.color);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtextInterpolate"](item_r16.title);
} }
function MsCalendar_div_2_div_1_div_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "div", 18);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](1, MsCalendar_div_2_div_1_div_2_div_1_Template, 2, 3, "div", 19);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
} if (rf & 2) {
    const idx_r6 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵnextContext"]().index;
    const ctx_r8 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngForOf", ctx_r8.items[idx_r6]);
} }
function MsCalendar_div_2_div_1_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "div", 9);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](1, MsCalendar_div_2_div_1_div_1_Template, 2, 1, "div", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](2, MsCalendar_div_2_div_1_div_2_Template, 2, 1, "div", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
} if (rf & 2) {
    const row_r5 = ctx.$implicit;
    const idx_r6 = ctx.index;
    const ctx_r4 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngForOf", row_r5);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", ctx_r4.items[idx_r6]);
} }
function MsCalendar_div_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "div", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](1, MsCalendar_div_2_div_1_Template, 3, 2, "div", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r1 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngForOf", ctx_r1.rows);
} }
class MsCalendar {
    constructor() {
        this.items = new Array();
        this.days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        this.rows = new Array();
    }
    ngOnInit() {
        this.init();
    }
    init() {
        if (this.data) {
            this.id = this.data.id;
            this.rows = Object(_utils__WEBPACK_IMPORTED_MODULE_0__["monthlyTable"])(this.data.id);
            this.data.items.forEach((item) => {
                const start = new Date(item.range.start);
                const end = new Date(item.range.end);
                const startDay = start.getDate();
                const endDay = end.getDate();
                let isFound = false;
                let isRangeFound = false;
                for (let i = 0; i < this.rows.length; i++) {
                    let calItem = JSON.parse(JSON.stringify(item));
                    calItem.cal = { from: undefined, to: undefined, width: undefined };
                    for (let j = 0; j < this.rows[i].length; j++) {
                        let cell = this.rows[i][j];
                        if (cell === undefined) {
                            continue;
                        }
                        if (cell.title === startDay) {
                            calItem.cal.from = j;
                            isFound = true;
                        }
                        if (cell.title === endDay) {
                            calItem.cal.to = j;
                        }
                    }
                    if (isFound) {
                        if (calItem.cal.from !== undefined &&
                            calItem.cal.to === undefined) {
                            calItem.cal.to = 6;
                        }
                        else if (calItem.cal.from === undefined &&
                            calItem.cal.to !== undefined) {
                            calItem.cal.from = 0;
                            isRangeFound = true;
                        }
                        else if (calItem.cal.from !== undefined &&
                            calItem.cal.to !== undefined) {
                            isRangeFound = true;
                        }
                        else if (calItem.cal.from === undefined &&
                            calItem.cal.to === undefined) {
                            calItem.cal.from = 0;
                            calItem.cal.to = 6;
                        }
                        if (this.items[i] === undefined) {
                            this.items[i] = new Array();
                        }
                        calItem.cal.width = calItem.cal.to - calItem.cal.from + 1;
                        this.items[i].push(calItem);
                        if (isRangeFound) {
                            break;
                        }
                    }
                }
            });
        }
    }
    onCellClick(cell) {
        console.log(cell);
    }
}
MsCalendar.ɵfac = function MsCalendar_Factory(t) { return new (t || MsCalendar)(); };
MsCalendar.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineComponent"]({ type: MsCalendar, selectors: [["ms-calendar"]], inputs: { data: "data" }, decls: 3, vars: 2, consts: [[1, "calendar"], ["class", "header", 4, "ngIf"], ["class", "body", 4, "ngIf"], [1, "header"], [1, "week"], ["class", "day", 4, "ngFor", "ngForOf"], [1, "day"], [1, "body"], ["class", "cal_row", 4, "ngFor", "ngForOf"], [1, "cal_row"], ["class", "cal_cell", 4, "ngFor", "ngForOf"], ["class", "item_row", 4, "ngIf"], [1, "cal_cell"], [4, "ngIf"], ["class", "value highlighted", 3, "background", 4, "ngIf"], ["class", "value", 4, "ngIf"], [1, "value", "highlighted"], [1, "value"], [1, "item_row"], ["class", "item_cell", "matRipple", "", 3, "style", "click", 4, "ngFor", "ngForOf"], ["matRipple", "", 1, "item_cell", 3, "click"]], template: function MsCalendar_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "div", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](1, MsCalendar_div_1_Template, 3, 1, "div", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](2, MsCalendar_div_2_Template, 2, 1, "div", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", ctx.id);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", ctx.id);
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_2__["NgIf"], _angular_common__WEBPACK_IMPORTED_MODULE_2__["NgForOf"], _angular_material_core__WEBPACK_IMPORTED_MODULE_3__["MatRipple"]], encapsulation: 2 });


/***/ }),

/***/ "D+go":
/*!**********************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/repositories/segment.ts ***!
  \**********************************************************/
/*! exports provided: Segment */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Segment", function() { return Segment; });
/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./utils */ "kVHy");

class Segment {
    constructor(path, data, bound) {
        this.path = path;
        this.bound = bound;
        let segmentData = JSON.parse(JSON.stringify(data));
        segmentData.num = data.limit.max - data.limit.min;
        segmentData.values = undefined;
        //distribution points and handles are not separate
        //handles should be distributed along points!!!
        this.points = _utils__WEBPACK_IMPORTED_MODULE_0__["DefaultDistributor"].distribute(segmentData, this.path, bound);
        this.handles = _utils__WEBPACK_IMPORTED_MODULE_0__["DefaultDistributor"].distribute(data, this.path, bound, segmentData.num);
        for (let i = 0; i < this.handles.length; i++) {
            this.handles[i].x = this.points[this.handles[i].value].x;
            this.handles[i].y = this.points[this.handles[i].value].y;
        }
        if (data.values !== undefined) {
            this.positions = data.values;
        }
        else {
            this.positions = [];
        }
    }
    get _path() {
        return this.path;
    }
    get _bound() {
        return this.bound;
    }
    set _bound(bound) {
        this.bound = bound;
    }
    get _points() {
        return this.points;
    }
    update(bound) {
    }
    nearby(idx, point, handleSize) {
        let points = new Array();
        let svgX = point.x - this.bound.rect.left;
        let svgY = point.y - this.bound.rect.top;
        let svgPoint = { x: svgX, y: svgY };
        let pointIdx;
        let minDistance = Infinity;
        for (let i = 0; i < this.points.length; i++) {
            let distance = _utils__WEBPACK_IMPORTED_MODULE_0__["Calc"].distance2(this.points[i], svgPoint);
            if (minDistance > distance) {
                minDistance = distance;
                pointIdx = i;
            }
        }
        ;
        this.handles[idx] = this.points[pointIdx];
        this.positions[idx] = pointIdx;
        points.push({ idx: idx, point: this.handles[idx] });
        for (let i = 0; i < idx; i++) {
            if (this.positions[i] >= this.positions[idx]) {
                this.handles[i] = this.handles[idx];
                this.positions[i] = this.positions[idx];
                points.push({ idx: i, point: this.handles[i] });
            }
        }
        for (let i = idx + 1; i < this.handles.length; i++) {
            if (this.positions[i] <= this.positions[idx]) {
                this.handles[i] = this.handles[idx];
                this.positions[i] = this.positions[idx];
                points.push({ idx: i, point: this.handles[i] });
            }
        }
        return points;
    }
}


/***/ }),

/***/ "EnSQ":
/*!******************************************!*\
  !*** ./src/app/services/data.service.ts ***!
  \******************************************/
/*! exports provided: DataService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "DataService", function() { return DataService; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");

const professions = [
    { value: 'm', viewValue: 'Management' },
    { value: 'bfo', viewValue: 'Business and Financial Operations' },
    { value: 'cm', viewValue: 'Computer and Mathematical' },
    { value: 'ae', viewValue: 'Architecture and Engineering' },
    { value: 'lps', viewValue: 'Life, Physical and Social Science' },
    { value: 'css', viewValue: 'Community and Social Service' },
    { value: 'l', viewValue: 'Legal' },
    { value: 'eil', viewValue: 'Educational Instruction and Library' },
    {
        value: 'adesm',
        viewValue: 'Arts, Design, Entertainment, Sports, and Media',
    },
    { value: 'hpt', viewValue: 'Healthcare Practitioners and Technical' },
    { value: 'hs', viewValue: 'Healthcare Support' },
    { value: 'ps', viewValue: 'Protective Service' },
    { value: 'fps', viewValue: 'Food Preparation and Serving' },
    {
        value: 'bgcm',
        viewValue: 'Building and Grounds Cleaning and Maintenance',
    },
    { value: 'pcs', viewValue: 'Personal Care and Service' },
    { value: 's', viewValue: 'Sales' },
    { value: 'oas', viewValue: 'Office and Administrative Support' },
    { value: 'fff', viewValue: 'Farming, Fishing, and Forestry' },
    { value: 'ce', viewValue: 'Construction and Extraction' },
    { value: 'imr', viewValue: 'Installation, Maintenance, and Repair' },
    { value: 'p', viewValue: 'Production' },
    { value: 'tmm', viewValue: 'Transportation and Material Moving' },
    { value: 'ms', viewValue: 'Military Specific' },
];
const physiques = [
    { value: 's', viewValue: 'Slim' },
    { value: 'a', viewValue: 'Average' },
    { value: 'sp', viewValue: 'Sum plus' },
    { value: 'm', viewValue: 'Muscular' },
];
const religions = [
    { value: 'ch', viewValue: 'Christianity' },
    { value: 'is', viewValue: 'Islam' },
    { value: 'hi', viewValue: 'Hinduism' },
    { value: 'ci', viewValue: 'Chinese' },
    { value: 'bu', viewValue: 'Buddhism' },
    { value: 'pr', viewValue: 'Primal-indigenous' },
    { value: 'af', viewValue: 'African' },
    { value: 'si', viewValue: 'Sikhism' },
    { value: 'juc', viewValue: 'Juche' },
    { value: 'sp', viewValue: 'Spiritism' },
    { value: 'jud', viewValue: 'Judaism' },
    { value: 'ba', viewValue: 'Bahai' },
    { value: 'ja', viewValue: 'Jainism' },
    { value: 'sh', viewValue: 'Shinto' },
    { value: 'ca', viewValue: 'Cao Dai' },
    { value: 'zo', viewValue: 'Zoroastrianism' },
    { value: 'te', viewValue: 'Tenrikyo' },
    { value: 'neo', viewValue: 'Neo-Paganism' },
    { value: 'un', viewValue: 'Unitarian-Universalism' },
    { value: 'nr', viewValue: 'Nonreligious' },
];
const languages = [
    { viewValue: 'Afar', value: 'aa' },
    { viewValue: 'Abkhazian', value: 'ab' },
    { viewValue: 'Avestan', value: 'ae' },
    { viewValue: 'Afrikaans', value: 'af' },
    { viewValue: 'Akan', value: 'ak' },
    { viewValue: 'Amharic', value: 'am' },
    { viewValue: 'Aragonese', value: 'an' },
    { viewValue: 'Arabic', value: 'ar' },
    { viewValue: 'Assamese', value: 'as' },
    { viewValue: 'Avaric', value: 'av' },
    { viewValue: 'Aymara', value: 'ay' },
    { viewValue: 'Azerbaijani', value: 'az' },
    { viewValue: 'Bashkir', value: 'ba' },
    { viewValue: 'Belarusian', value: 'be' },
    { viewValue: 'Bulgarian', value: 'bg' },
    { viewValue: 'Bihari languages', value: 'bh' },
    { viewValue: 'Bislama', value: 'bi' },
    { viewValue: 'Bambara', value: 'bm' },
    { viewValue: 'Bengali', value: 'bn' },
    { viewValue: 'Tibetan', value: 'bo' },
    { viewValue: 'Breton', value: 'br' },
    { viewValue: 'Bosnian', value: 'bs' },
    { viewValue: 'Catalan; Valencian', value: 'ca' },
    { viewValue: 'Chechen', value: 'ce' },
    { viewValue: 'Chamorro', value: 'ch' },
    { viewValue: 'Corsican', value: 'co' },
    { viewValue: 'Cree', value: 'cr' },
    { viewValue: 'Czech', value: 'cs' },
    {
        viewValue: 'Church Slavic; Old Slavonic; Church Slavonic; Old Bulgarian; Old Church Slavonic',
        value: 'cu',
    },
    { viewValue: 'Chuvash', value: 'cv' },
    { viewValue: 'Welsh', value: 'cy' },
    { viewValue: 'Danish', value: 'da' },
    { viewValue: 'German', value: 'de' },
    { viewValue: 'Divehi; Dhivehi; Maldivian', value: 'dv' },
    { viewValue: 'Dzongkha', value: 'dz' },
    { viewValue: 'Ewe', value: 'ee' },
    { viewValue: 'Greek, Modern (1453-)', value: 'el' },
    { viewValue: 'English', value: 'en' },
    { viewValue: 'Esperanto', value: 'eo' },
    { viewValue: 'Spanish; Castilian', value: 'es' },
    { viewValue: 'Estonian', value: 'et' },
    { viewValue: 'Basque', value: 'eu' },
    { viewValue: 'Persian', value: 'fa' },
    { viewValue: 'Fulah', value: 'ff' },
    { viewValue: 'Finnish', value: 'fi' },
    { viewValue: 'Fijian', value: 'fj' },
    { viewValue: 'Faroese', value: 'fo' },
    { viewValue: 'French', value: 'fr' },
    { viewValue: 'Western Frisian', value: 'fy' },
    { viewValue: 'Irish', value: 'ga' },
    { viewValue: 'Gaelic; Scottish Gaelic', value: 'gd' },
    { viewValue: 'Galician', value: 'gl' },
    { viewValue: 'Guarani', value: 'gn' },
    { viewValue: 'Gujarati', value: 'gu' },
    { viewValue: 'Manx', value: 'gv' },
    { viewValue: 'Hausa', value: 'ha' },
    { viewValue: 'Hebrew', value: 'he' },
    { viewValue: 'Hindi', value: 'hi' },
    { viewValue: 'Hiri Motu', value: 'ho' },
    { viewValue: 'Croatian', value: 'hr' },
    { viewValue: 'Haitian; Haitian Creole', value: 'ht' },
    { viewValue: 'Hungarian', value: 'hu' },
    { viewValue: 'Armenian', value: 'hy' },
    { viewValue: 'Herero', value: 'hz' },
    {
        viewValue: 'Interlingua (International Auxiliary Language Association)',
        value: 'ia',
    },
    { viewValue: 'Indonesian', value: 'id' },
    { viewValue: 'Interlingue; Occidental', value: 'ie' },
    { viewValue: 'Igbo', value: 'ig' },
    { viewValue: 'Sichuan Yi; Nuosu', value: 'ii' },
    { viewValue: 'Inupiaq', value: 'ik' },
    { viewValue: 'Ido', value: 'io' },
    { viewValue: 'Icelandic', value: 'is' },
    { viewValue: 'Italian', value: 'it' },
    { viewValue: 'Inuktitut', value: 'iu' },
    { viewValue: 'Japanese', value: 'ja' },
    { viewValue: 'Javanese', value: 'jv' },
    { viewValue: 'Georgian', value: 'ka' },
    { viewValue: 'Kongo', value: 'kg' },
    { viewValue: 'Kikuyu; Gikuyu', value: 'ki' },
    { viewValue: 'Kuanyama; Kwanyama', value: 'kj' },
    { viewValue: 'Kazakh', value: 'kk' },
    { viewValue: 'Kalaallisut; Greenlandic', value: 'kl' },
    { viewValue: 'Central Khmer', value: 'km' },
    { viewValue: 'Kannada', value: 'kn' },
    { viewValue: 'Korean', value: 'ko' },
    { viewValue: 'Kanuri', value: 'kr' },
    { viewValue: 'Kashmiri', value: 'ks' },
    { viewValue: 'Kurdish', value: 'ku' },
    { viewValue: 'Komi', value: 'kv' },
    { viewValue: 'Cornish', value: 'kw' },
    { viewValue: 'Kirghiz; Kyrgyz', value: 'ky' },
    { viewValue: 'Latin', value: 'la' },
    { viewValue: 'Luxembourgish; Letzeburgesch', value: 'lb' },
    { viewValue: 'Ganda', value: 'lg' },
    { viewValue: 'Limburgan; Limburger; Limburgish', value: 'li' },
    { viewValue: 'Lingala', value: 'ln' },
    { viewValue: 'Lao', value: 'lo' },
    { viewValue: 'Lithuanian', value: 'lt' },
    { viewValue: 'Luba-Katanga', value: 'lu' },
    { viewValue: 'Latvian', value: 'lv' },
    { viewValue: 'Malagasy', value: 'mg' },
    { viewValue: 'Marshallese', value: 'mh' },
    { viewValue: 'Maori', value: 'mi' },
    { viewValue: 'Macedonian', value: 'mk' },
    { viewValue: 'Malayalam', value: 'ml' },
    { viewValue: 'Mongolian', value: 'mn' },
    { viewValue: 'Marathi', value: 'mr' },
    { viewValue: 'Malay', value: 'ms' },
    { viewValue: 'Maltese', value: 'mt' },
    { viewValue: 'Burmese', value: 'my' },
    { viewValue: 'Nauru', value: 'na' },
    {
        viewValue: 'Bokm\u00e5l, Norwegian; Norwegian Bokm\u00e5l',
        value: 'nb',
    },
    { viewValue: 'Ndebele, North; North Ndebele', value: 'nd' },
    { viewValue: 'Nepali', value: 'ne' },
    { viewValue: 'Ndonga', value: 'ng' },
    { viewValue: 'Dutch; Flemish', value: 'nl' },
    { viewValue: 'Norwegian Nynorsk; Nynorsk, Norwegian', value: 'nn' },
    { viewValue: 'Norwegian', value: 'no' },
    { viewValue: 'Ndebele, South; South Ndebele', value: 'nr' },
    { viewValue: 'Navajo; Navaho', value: 'nv' },
    { viewValue: 'Chichewa; Chewa; Nyanja', value: 'ny' },
    { viewValue: 'Occitan (post 1500)', value: 'oc' },
    { viewValue: 'Ojibwa', value: 'oj' },
    { viewValue: 'Oromo', value: 'om' },
    { viewValue: 'Oriya', value: 'or' },
    { viewValue: 'Ossetian; Ossetic', value: 'os' },
    { viewValue: 'Panjabi; Punjabi', value: 'pa' },
    { viewValue: 'Pali', value: 'pi' },
    { viewValue: 'Polish', value: 'pl' },
    { viewValue: 'Pushto; Pashto', value: 'ps' },
    { viewValue: 'Portuguese', value: 'pt' },
    { viewValue: 'Quechua', value: 'qu' },
    { viewValue: 'Romansh', value: 'rm' },
    { viewValue: 'Rundi', value: 'rn' },
    { viewValue: 'Romanian; Moldavian; Moldovan', value: 'ro' },
    { viewValue: 'Russian', value: 'ru' },
    { viewValue: 'Kinyarwanda', value: 'rw' },
    { viewValue: 'Sanskrit', value: 'sa' },
    { viewValue: 'Sardinian', value: 'sc' },
    { viewValue: 'Sindhi', value: 'sd' },
    { viewValue: 'Northern Sami', value: 'se' },
    { viewValue: 'Sango', value: 'sg' },
    { viewValue: 'Sinhala; Sinhalese', value: 'si' },
    { viewValue: 'Slovak', value: 'sk' },
    { viewValue: 'Slovenian', value: 'sl' },
    { viewValue: 'Samoan', value: 'sm' },
    { viewValue: 'Shona', value: 'sn' },
    { viewValue: 'Somali', value: 'so' },
    { viewValue: 'Albanian', value: 'sq' },
    { viewValue: 'Serbian', value: 'sr' },
    { viewValue: 'Swati', value: 'ss' },
    { viewValue: 'Sotho, Southern', value: 'st' },
    { viewValue: 'Sundanese', value: 'su' },
    { viewValue: 'Swedish', value: 'sv' },
    { viewValue: 'Swahili', value: 'sw' },
    { viewValue: 'Tamil', value: 'ta' },
    { viewValue: 'Telugu', value: 'te' },
    { viewValue: 'Tajik', value: 'tg' },
    { viewValue: 'Thai', value: 'th' },
    { viewValue: 'Tigrinya', value: 'ti' },
    { viewValue: 'Turkmen', value: 'tk' },
    { viewValue: 'Tagalog', value: 'tl' },
    { viewValue: 'Tswana', value: 'tn' },
    { viewValue: 'Tonga (Tonga Islands)', value: 'to' },
    { viewValue: 'Turkish', value: 'tr' },
    { viewValue: 'Tsonga', value: 'ts' },
    { viewValue: 'Tatar', value: 'tt' },
    { viewValue: 'Twi', value: 'tw' },
    { viewValue: 'Tahitian', value: 'ty' },
    { viewValue: 'Uighur; Uyghur', value: 'ug' },
    { viewValue: 'Ukrainian', value: 'uk' },
    { viewValue: 'Urdu', value: 'ur' },
    { viewValue: 'Uzbek', value: 'uz' },
    { viewValue: 'Venda', value: 've' },
    { viewValue: 'Vietnamese', value: 'vi' },
    { viewValue: 'Volap\u00fck', value: 'vo' },
    { viewValue: 'Walloon', value: 'wa' },
    { viewValue: 'Wolof', value: 'wo' },
    { viewValue: 'Xhosa', value: 'xh' },
    { viewValue: 'Yiddish', value: 'yi' },
    { viewValue: 'Yoruba', value: 'yo' },
    { viewValue: 'Zhuang; Chuang', value: 'za' },
    { viewValue: 'Chinese', value: 'zh' },
    { viewValue: 'Zulu', value: 'zu' },
];
const categories = [
    { viewValue: 'Study', value: 's' },
    { viewValue: 'Work', value: 'w' },
];
const currencies = [
    {
        value: 'AED',
        viewValue: 'United Arab Emirates Dirham',
    },
    {
        value: 'AFN',
        viewValue: 'Afghan Afghani',
    },
    {
        value: 'ALL',
        viewValue: 'Albanian Lek',
    },
    {
        value: 'AMD',
        viewValue: 'Armenian Dram',
    },
    {
        value: 'ANG',
        viewValue: 'Netherlands Antillean Guilder',
    },
    {
        value: 'AOA',
        viewValue: 'Angolan Kwanza',
    },
    {
        value: 'ARS',
        viewValue: 'Argentine Peso',
    },
    {
        value: 'AUD',
        viewValue: 'Australian Dollar',
    },
    {
        value: 'AWG',
        viewValue: 'Aruban Florin',
    },
    {
        value: 'AZN',
        viewValue: 'Azerbaijani Manat',
    },
    {
        value: 'BAM',
        viewValue: 'Bosnia-Herzegovina Convertible Mark',
    },
    {
        value: 'BBD',
        viewValue: 'Barbadian Dollar',
    },
    {
        value: 'BDT',
        viewValue: 'Bangladeshi Taka',
    },
    {
        value: 'BGN',
        viewValue: 'Bulgarian Lev',
    },
    {
        value: 'BHD',
        viewValue: 'Bahraini Dinar',
    },
    {
        value: 'BIF',
        viewValue: 'Burundian Franc',
    },
    {
        value: 'BMD',
        viewValue: 'Bermudan Dollar',
    },
    {
        value: 'BND',
        viewValue: 'Brunei Dollar',
    },
    {
        value: 'BOB',
        viewValue: 'Bolivian Boliviano',
    },
    {
        value: 'BRL',
        viewValue: 'Brazilian Real',
    },
    {
        value: 'BSD',
        viewValue: 'Bahamian Dollar',
    },
    {
        value: 'BTC',
        viewValue: 'Bitcoin',
    },
    {
        value: 'BTN',
        viewValue: 'Bhutanese Ngultrum',
    },
    {
        value: 'BWP',
        viewValue: 'Botswanan Pula',
    },
    {
        value: 'BYN',
        viewValue: 'Belarusian Ruble',
    },
    {
        value: 'BZD',
        viewValue: 'Belize Dollar',
    },
    {
        value: 'CAD',
        viewValue: 'Canadian Dollar',
    },
    {
        value: 'CDF',
        viewValue: 'Congolese Franc',
    },
    {
        value: 'CHF',
        viewValue: 'Swiss Franc',
    },
    {
        value: 'CLF',
        viewValue: 'Chilean Unit of Account (UF)',
    },
    {
        value: 'CLP',
        viewValue: 'Chilean Peso',
    },
    {
        value: 'CNH',
        viewValue: 'Chinese Yuan (Offshore)',
    },
    {
        value: 'CNY',
        viewValue: 'Chinese Yuan',
    },
    {
        value: 'COP',
        viewValue: 'Colombian Peso',
    },
    {
        value: 'CRC',
        viewValue: 'Costa Rican Colón',
    },
    {
        value: 'CUC',
        viewValue: 'Cuban Convertible Peso',
    },
    {
        value: 'CUP',
        viewValue: 'Cuban Peso',
    },
    {
        value: 'CVE',
        viewValue: 'Cape Verdean Escudo',
    },
    {
        value: 'CZK',
        viewValue: 'Czech Republic Koruna',
    },
    {
        value: 'DJF',
        viewValue: 'Djiboutian Franc',
    },
    {
        value: 'DKK',
        viewValue: 'Danish Krone',
    },
    {
        value: 'DOP',
        viewValue: 'Dominican Peso',
    },
    {
        value: 'DZD',
        viewValue: 'Algerian Dinar',
    },
    {
        value: 'EGP',
        viewValue: 'Egyptian Pound',
    },
    {
        value: 'ERN',
        viewValue: 'Eritrean Nakfa',
    },
    {
        value: 'ETB',
        viewValue: 'Ethiopian Birr',
    },
    {
        value: 'EUR',
        viewValue: 'Euro',
    },
    {
        value: 'FJD',
        viewValue: 'Fijian Dollar',
    },
    {
        value: 'FKP',
        viewValue: 'Falkland Islands Pound',
    },
    {
        value: 'GBP',
        viewValue: 'British Pound Sterling',
    },
    {
        value: 'GEL',
        viewValue: 'Georgian Lari',
    },
    {
        value: 'GGP',
        viewValue: 'Guernsey Pound',
    },
    {
        value: 'GHS',
        viewValue: 'Ghanaian Cedi',
    },
    {
        value: 'GIP',
        viewValue: 'Gibraltar Pound',
    },
    {
        value: 'GMD',
        viewValue: 'Gambian Dalasi',
    },
    {
        value: 'GNF',
        viewValue: 'Guinean Franc',
    },
    {
        value: 'GTQ',
        viewValue: 'Guatemalan Quetzal',
    },
    {
        value: 'GYD',
        viewValue: 'Guyanaese Dollar',
    },
    {
        value: 'HKD',
        viewValue: 'Hong Kong Dollar',
    },
    {
        value: 'HNL',
        viewValue: 'Honduran Lempira',
    },
    {
        value: 'HRK',
        viewValue: 'Croatian Kuna',
    },
    {
        value: 'HTG',
        viewValue: 'Haitian Gourde',
    },
    {
        value: 'HUF',
        viewValue: 'Hungarian Forint',
    },
    {
        value: 'IDR',
        viewValue: 'Indonesian Rupiah',
    },
    {
        value: 'ILS',
        viewValue: 'Israeli New Sheqel',
    },
    {
        value: 'IMP',
        viewValue: 'Manx pound',
    },
    {
        value: 'INR',
        viewValue: 'Indian Rupee',
    },
    {
        value: 'IQD',
        viewValue: 'Iraqi Dinar',
    },
    {
        value: 'IRR',
        viewValue: 'Iranian Rial',
    },
    {
        value: 'ISK',
        viewValue: 'Icelandic Króna',
    },
    {
        value: 'JEP',
        viewValue: 'Jersey Pound',
    },
    {
        value: 'JMD',
        viewValue: 'Jamaican Dollar',
    },
    {
        value: 'JOD',
        viewValue: 'Jordanian Dinar',
    },
    {
        value: 'JPY',
        viewValue: 'Japanese Yen',
    },
    {
        value: 'KES',
        viewValue: 'Kenyan Shilling',
    },
    {
        value: 'KGS',
        viewValue: 'Kyrgystani Som',
    },
    {
        value: 'KHR',
        viewValue: 'Cambodian Riel',
    },
    {
        value: 'KMF',
        viewValue: 'Comorian Franc',
    },
    {
        value: 'KPW',
        viewValue: 'North Korean Won',
    },
    {
        value: 'KRW',
        viewValue: 'South Korean Won',
    },
    {
        value: 'KWD',
        viewValue: 'Kuwaiti Dinar',
    },
    {
        value: 'KYD',
        viewValue: 'Cayman Islands Dollar',
    },
    {
        value: 'KZT',
        viewValue: 'Kazakhstani Tenge',
    },
    {
        value: 'LAK',
        viewValue: 'Laotian Kip',
    },
    {
        value: 'LBP',
        viewValue: 'Lebanese Pound',
    },
    {
        value: 'LKR',
        viewValue: 'Sri Lankan Rupee',
    },
    {
        value: 'LRD',
        viewValue: 'Liberian Dollar',
    },
    {
        value: 'LSL',
        viewValue: 'Lesotho Loti',
    },
    {
        value: 'LYD',
        viewValue: 'Libyan Dinar',
    },
    {
        value: 'MAD',
        viewValue: 'Moroccan Dirham',
    },
    {
        value: 'MDL',
        viewValue: 'Moldovan Leu',
    },
    {
        value: 'MGA',
        viewValue: 'Malagasy Ariary',
    },
    {
        value: 'MKD',
        viewValue: 'Macedonian Denar',
    },
    {
        value: 'MMK',
        viewValue: 'Myanma Kyat',
    },
    {
        value: 'MNT',
        viewValue: 'Mongolian Tugrik',
    },
    {
        value: 'MOP',
        viewValue: 'Macanese Pataca',
    },
    {
        value: 'MRO',
        viewValue: 'Mauritanian Ouguiya (pre-2018)',
    },
    {
        value: 'MRU',
        viewValue: 'Mauritanian Ouguiya',
    },
    {
        value: 'MUR',
        viewValue: 'Mauritian Rupee',
    },
    {
        value: 'MVR',
        viewValue: 'Maldivian Rufiyaa',
    },
    {
        value: 'MWK',
        viewValue: 'Malawian Kwacha',
    },
    {
        value: 'MXN',
        viewValue: 'Mexican Peso',
    },
    {
        value: 'MYR',
        viewValue: 'Malaysian Ringgit',
    },
    {
        value: 'MZN',
        viewValue: 'Mozambican Metical',
    },
    {
        value: 'NAD',
        viewValue: 'Namibian Dollar',
    },
    {
        value: 'NGN',
        viewValue: 'Nigerian Naira',
    },
    {
        value: 'NIO',
        viewValue: 'Nicaraguan Córdoba',
    },
    {
        value: 'NOK',
        viewValue: 'Norwegian Krone',
    },
    {
        value: 'NPR',
        viewValue: 'Nepalese Rupee',
    },
    {
        value: 'NZD',
        viewValue: 'New Zealand Dollar',
    },
    {
        value: 'OMR',
        viewValue: 'Omani Rial',
    },
    {
        value: 'PAB',
        viewValue: 'Panamanian Balboa',
    },
    {
        value: 'PEN',
        viewValue: 'Peruvian Nuevo Sol',
    },
    {
        value: 'PGK',
        viewValue: 'Papua New Guinean Kina',
    },
    {
        value: 'PHP',
        viewValue: 'Philippine Peso',
    },
    {
        value: 'PKR',
        viewValue: 'Pakistani Rupee',
    },
    {
        value: 'PLN',
        viewValue: 'Polish Zloty',
    },
    {
        value: 'PYG',
        viewValue: 'Paraguayan Guarani',
    },
    {
        value: 'QAR',
        viewValue: 'Qatari Rial',
    },
    {
        value: 'RON',
        viewValue: 'Romanian Leu',
    },
    {
        value: 'RSD',
        viewValue: 'Serbian Dinar',
    },
    {
        value: 'RUB',
        viewValue: 'Russian Ruble',
    },
    {
        value: 'RWF',
        viewValue: 'Rwandan Franc',
    },
    {
        value: 'SAR',
        viewValue: 'Saudi Riyal',
    },
    {
        value: 'SBD',
        viewValue: 'Solomon Islands Dollar',
    },
    {
        value: 'SCR',
        viewValue: 'Seychellois Rupee',
    },
    {
        value: 'SDG',
        viewValue: 'Sudanese Pound',
    },
    {
        value: 'SEK',
        viewValue: 'Swedish Krona',
    },
    {
        value: 'SGD',
        viewValue: 'Singapore Dollar',
    },
    {
        value: 'SHP',
        viewValue: 'Saint Helena Pound',
    },
    {
        value: 'SLL',
        viewValue: 'Sierra Leonean Leone',
    },
    {
        value: 'SOS',
        viewValue: 'Somali Shilling',
    },
    {
        value: 'SRD',
        viewValue: 'Surinamese Dollar',
    },
    {
        value: 'SSP',
        viewValue: 'South Sudanese Pound',
    },
    {
        value: 'STD',
        viewValue: 'São Tomé and Príncipe Dobra (pre-2018)',
    },
    {
        value: 'STN',
        viewValue: 'São Tomé and Príncipe Dobra',
    },
    {
        value: 'SVC',
        viewValue: 'Salvadoran Colón',
    },
    {
        value: 'SYP',
        viewValue: 'Syrian Pound',
    },
    {
        value: 'SZL',
        viewValue: 'Swazi Lilangeni',
    },
    {
        value: 'THB',
        viewValue: 'Thai Baht',
    },
    {
        value: 'TJS',
        viewValue: 'Tajikistani Somoni',
    },
    {
        value: 'TMT',
        viewValue: 'Turkmenistani Manat',
    },
    {
        value: 'TND',
        viewValue: 'Tunisian Dinar',
    },
    {
        value: 'TOP',
        viewValue: "Tongan Pa'anga",
    },
    {
        value: 'TRY',
        viewValue: 'Turkish Lira',
    },
    {
        value: 'TTD',
        viewValue: 'Trinidad and Tobago Dollar',
    },
    {
        value: 'TWD',
        viewValue: 'New Taiwan Dollar',
    },
    {
        value: 'TZS',
        viewValue: 'Tanzanian Shilling',
    },
    {
        value: 'UAH',
        viewValue: 'Ukrainian Hryvnia',
    },
    {
        value: 'UGX',
        viewValue: 'Ugandan Shilling',
    },
    {
        value: 'USD',
        viewValue: 'United States Dollar',
    },
    {
        value: 'UYU',
        viewValue: 'Uruguayan Peso',
    },
    {
        value: 'UZS',
        viewValue: 'Uzbekistan Som',
    },
    {
        value: 'VEF',
        viewValue: 'Venezuelan Bolívar Fuerte (Old)',
    },
    {
        value: 'VES',
        viewValue: 'Venezuelan Bolívar Soberano',
    },
    {
        value: 'VND',
        viewValue: 'Vietnamese Dong',
    },
    {
        value: 'VUV',
        viewValue: 'Vanuatu Vatu',
    },
    {
        value: 'WST',
        viewValue: 'Samoan Tala',
    },
    {
        value: 'XAF',
        viewValue: 'CFA Franc BEAC',
    },
    {
        value: 'XAG',
        viewValue: 'Silver Ounce',
    },
    {
        value: 'XAU',
        viewValue: 'Gold Ounce',
    },
    {
        value: 'XCD',
        viewValue: 'East Caribbean Dollar',
    },
    {
        value: 'XDR',
        viewValue: 'Special Drawing Rights',
    },
    {
        value: 'XOF',
        viewValue: 'CFA Franc BCEAO',
    },
    {
        value: 'XPD',
        viewValue: 'Palladium Ounce',
    },
    {
        value: 'XPF',
        viewValue: 'CFP Franc',
    },
    {
        value: 'XPT',
        viewValue: 'Platinum Ounce',
    },
    {
        value: 'YER',
        viewValue: 'Yemeni Rial',
    },
    {
        value: 'ZAR',
        viewValue: 'South African Rand',
    },
    {
        value: 'ZMW',
        viewValue: 'Zambian Kwacha',
    },
    {
        value: 'ZWL',
        viewValue: 'Zimbabwean Dollar',
    },
];
const eventCategories = [
    { value: 'l', viewValue: 'Local' },
    { value: 't', viewValue: 'Travel' },
];
const eventTypes = [
    { value: 'g', viewValue: 'General' },
    { value: 'c', viewValue: 'Car' },
    { value: 'a', viewValue: 'Accomodation' },
    { value: 'p', viewValue: 'Private' },
];
const statuses = [
    { value: 'I', viewValue: 'Invisible' },
    { value: 'F', viewValue: 'Friends Only' },
    { value: 'A', viewValue: 'All' },
];
const groupTypes = [
    { value: 'd', viewValue: 'Dating' },
    // { value: 'b', viewValue: 'Business' },
    { value: 't', viewValue: 'Team Building' },
];
const groupVisibilities = [
    { value: 'pr', viewValue: 'Private' },
    // { value: 'b', viewValue: 'Business' },
    { value: 'pu', viewValue: 'Public' },
];
const roles = [
    { value: 'ROLE_ADMIN', viewValue: 'Admin' },
    { value: 'ROLE_USER', viewValue: 'User' },
];
const profileStatuses = [
    { value: 'P', viewValue: 'Pending' },
    { value: 'A', viewValue: 'All' },
    { value: 'F', viewValue: 'Friends Only' },
    { value: 'S', viewValue: 'Suspended' },
];
const templateTypes = [
    { value: 'e', viewValue: 'Event' },
    { value: 'j', viewValue: 'Job' },
    { value: 'i', viewValue: 'Idea' },
];
// https://www.techiediaries.com/angular-11-tutorial-example-rest-crud-http-get-httpclient/
class DataService {
    get professions() {
        return professions;
    }
    get physiques() {
        return physiques;
    }
    get religions() {
        return religions;
    }
    get languages() {
        return languages;
    }
    get categories() {
        return categories;
    }
    get statuses() {
        return statuses;
    }
    get eventCategories() {
        return eventCategories;
    }
    get eventTypes() {
        return eventTypes;
    }
    get templateTypes() {
        return templateTypes;
    }
    get currencies() {
        return currencies;
    }
    get groupTypes() {
        return groupTypes;
    }
    get groupVisibilities() {
        return groupVisibilities;
    }
    get roles() {
        return roles;
    }
    get profileStatuses() {
        return profileStatuses;
    }
}
DataService.ɵfac = function DataService_Factory(t) { return new (t || DataService)(); };
DataService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: DataService, factory: DataService.ɵfac, providedIn: 'any' });


/***/ }),

/***/ "JCxZ":
/*!********************************************!*\
  !*** ./src/lib/ms-list/ms-action/index.ts ***!
  \********************************************/
/*! exports provided: MsAction */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MsAction", function() { return MsAction; });
/* harmony import */ var _angular_material_bottom_sheet__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/material/bottom-sheet */ "2ChS");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var src_app_services_list_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! src/app/services/list.service */ "YoPC");
/* harmony import */ var src_app_navigation_service__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! src/app/navigation.service */ "2NUr");
/* harmony import */ var _angular_router__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @angular/router */ "tyNb");
/* harmony import */ var _angular_material_list__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @angular/material/list */ "MutI");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _angular_material_icon__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! @angular/material/icon */ "NFeN");









function MsAction_button_1_ng_container_1_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "edit");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Edit ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "delete");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Delete ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "exit_to_app");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Leave ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_4_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "cancel_presentation");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Cancel ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_5_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "thumb_up");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Accept ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_6_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "thumb_up");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Publish ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_7_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "thumb_down");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Reject ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_8_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "thumb_up");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Recommend ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_9_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "qr_code_scanner");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Code ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_10_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "send");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Share ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_11_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "copy_all");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Clone ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_12_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "login");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Join ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_13_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](2, "hourglass_top");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "\u00A0\u00A0Waiting List ");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_14_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "a", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](2, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "chat");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](4, "\u00A0\u00A0");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](5, "p");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](6, "Chat");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_ng_container_15_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](1, "a", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](2, "mat-icon", 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](3, "location_on");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](4, "\u00A0\u00A0");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](5, "p");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](6, "Map");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementContainerEnd"]();
} }
function MsAction_button_1_Template(rf, ctx) { if (rf & 1) {
    const _r18 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "button", 1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵlistener"]("click", function MsAction_button_1_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵrestoreView"](_r18); const action_r1 = ctx.$implicit; const ctx_r17 = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵnextContext"](); return ctx_r17.do(action_r1); });
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](1, MsAction_button_1_ng_container_1_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](2, MsAction_button_1_ng_container_2_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](3, MsAction_button_1_ng_container_3_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](4, MsAction_button_1_ng_container_4_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](5, MsAction_button_1_ng_container_5_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](6, MsAction_button_1_ng_container_6_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](7, MsAction_button_1_ng_container_7_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](8, MsAction_button_1_ng_container_8_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](9, MsAction_button_1_ng_container_9_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](10, MsAction_button_1_ng_container_10_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](11, MsAction_button_1_ng_container_11_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](12, MsAction_button_1_ng_container_12_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](13, MsAction_button_1_ng_container_13_Template, 4, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](14, MsAction_button_1_ng_container_14_Template, 7, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](15, MsAction_button_1_ng_container_15_Template, 7, 0, "ng-container", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
} if (rf & 2) {
    const action_r1 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "E");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "D");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "L");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "CA");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "A");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "P");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "R");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "U");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "Q");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "S");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "C");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "J");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "W");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "CH");
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngIf", action_r1 === "M");
} }
// campaign button - is the big boom
class MsAction {
    constructor(menu, data, listService, navService, router) {
        this.menu = menu;
        this.data = data;
        this.listService = listService;
        this.navService = navService;
        this.router = router;
        this.actions = data.actions;
        this.chat = data.chat;
        this.map = this.buildMapLink(this.data.positions);
    }
    do(action) {
        switch (action) {
            case 'E':
                this.listService.edit.emit({ alias: this.data.alias });
                break;
            case 'L':
            case 'A':
            case 'R':
            case 'P':
            case 'CA':
            case 'W':
                this.listService.status.emit({ alias: this.data.alias, action });
                break;
            case 'D':
                this.listService.delete.emit({ alias: this.data.alias });
                break;
            case 'S': // share
                this.listService.share.emit({ alias: this.data.alias });
                break;
            case 'Q':
                this.listService.code.emit({ alias: this.data.alias });
                break;
            case 'C':
                this.listService.clone.emit({ alias: this.data.alias });
                break;
            case 'J':
                this.listService.join.emit({ alias: this.data.alias });
                break;
            case 'U':
                this.listService.recommend.emit({ alias: this.data.alias });
                break;
            case 'M':
                if (this.map !== undefined) {
                    window.open(this.map, '_blank');
                }
                break;
            case 'CH':
                if (this.chat !== undefined) {
                    window.open(this.chat, '_blank');
                }
                else {
                    this.listService.edit.emit({ alias: this.data.alias });
                }
                break;
        }
        this.menu.dismiss({ action });
    }
    buildMapLink(positions) {
        if (positions === undefined || positions.length === 0) {
            return undefined;
        }
        let link = '';
        if (positions.length === 1) {
            link =
                'https://www.google.com/maps/search/?api=1&query=' +
                    positions[0].x +
                    '%2C' +
                    positions[0].y;
        }
        else {
            link =
                'https://www.google.com/maps/dir/?api=1&origin=' +
                    positions[0].x +
                    '%2C' +
                    positions[0].y +
                    '&destination=' +
                    positions[positions.length - 1].x +
                    '%2C' +
                    positions[positions.length - 1].y;
            if (positions.length > 2) {
                link += '&waypoints=';
                for (let i = 1; i < positions.length - 1; i++) {
                    link += positions[i].x + '%2C' + positions[i].y;
                    if (i < positions.length - 2) {
                        link += '%7C';
                    }
                }
            }
        }
        return link;
    }
}
MsAction.ɵfac = function MsAction_Factory(t) { return new (t || MsAction)(_angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdirectiveInject"](_angular_material_bottom_sheet__WEBPACK_IMPORTED_MODULE_0__["MatBottomSheetRef"]), _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdirectiveInject"](_angular_material_bottom_sheet__WEBPACK_IMPORTED_MODULE_0__["MAT_BOTTOM_SHEET_DATA"]), _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdirectiveInject"](src_app_services_list_service__WEBPACK_IMPORTED_MODULE_2__["ListService"]), _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdirectiveInject"](src_app_navigation_service__WEBPACK_IMPORTED_MODULE_3__["NavigationService"]), _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdirectiveInject"](_angular_router__WEBPACK_IMPORTED_MODULE_4__["Router"])); };
MsAction.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineComponent"]({ type: MsAction, selectors: [["ms-action"]], decls: 2, vars: 1, consts: [["mat-list-item", "", 3, "click", 4, "ngFor", "ngForOf"], ["mat-list-item", "", 3, "click"], [4, "ngIf"], ["fontSet", "material-icons-outlined"], [1, "actionLink"]], template: function MsAction_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "mat-action-list");
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtemplate"](1, MsAction_button_1_Template, 16, 15, "button", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵproperty"]("ngForOf", ctx.actions);
    } }, directives: [_angular_material_list__WEBPACK_IMPORTED_MODULE_5__["MatList"], _angular_common__WEBPACK_IMPORTED_MODULE_6__["NgForOf"], _angular_material_list__WEBPACK_IMPORTED_MODULE_5__["MatListItem"], _angular_common__WEBPACK_IMPORTED_MODULE_6__["NgIf"], _angular_material_icon__WEBPACK_IMPORTED_MODULE_7__["MatIcon"]], encapsulation: 2 });


/***/ }),

/***/ "JL96":
/*!************************************!*\
  !*** ./src/lib/ms-qrcode/index.ts ***!
  \************************************/
/*! exports provided: MsQrcode */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MsQrcode", function() { return MsQrcode; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");


const _c0 = ["qrCode"];
class MsQrcode {
    constructor() {
        this.msScanned = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
    }
    onScanSuccess(qrMessage) {
        if (qrMessage !== this.lastResult) {
            this.lastResult = qrMessage;
            this.turnCamera(false, qrMessage);
        }
    }
    ngOnInit() { }
    ngOnChanges() {
        if (this.html5Qrcode === undefined) {
            this.html5Qrcode = new Html5Qrcode('reader', false);
        }
        this.turnCamera(this.camera);
    }
    turnCamera(on = false, sQRCode) {
        if (on === true) {
            const config = { fps: 10 };
            this.html5Qrcode
                .start({ facingMode: 'environment' }, config, (qrMessage) => this.onScanSuccess(qrMessage), (err) => { })
                .catch((err) => {
                // Stop failed, handle it.
            });
        }
        else {
            this.html5Qrcode
                .stop()
                .then((ignore) => {
                console.log('camera stopped');
                if (sQRCode !== undefined) {
                    this.msScanned.emit({ qrCode: sQRCode });
                }
            })
                .catch((err) => {
                // Stop failed, handle it.
            });
            setTimeout(() => {
                QRCode.toCanvas(this.qrCodeViewRef.nativeElement, this.qrCode, (error) => {
                    if (error) {
                        console.error(error);
                    }
                    console.log('success!');
                });
            });
        }
    }
    ngOnDestroy() {
        this.turnCamera(false);
    }
}
MsQrcode.ɵfac = function MsQrcode_Factory(t) { return new (t || MsQrcode)(); };
MsQrcode.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: MsQrcode, selectors: [["ms-qrcode"]], viewQuery: function MsQrcode_Query(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c0, 3);
    } if (rf & 2) {
        let _t;
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.qrCodeViewRef = _t.first);
    } }, inputs: { camera: "camera", qrCode: "qrCode" }, outputs: { msScanned: "msScanned" }, features: [_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵNgOnChangesFeature"]], decls: 4, vars: 0, consts: [[1, "qr"], ["id", "reader", 1, "scanner"], ["width", "100%", "height", "100%", 1, "code"], ["qrCode", ""]], template: function MsQrcode_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](1, "div", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](2, "canvas", 2, 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } }, encapsulation: 2 });


/***/ }),

/***/ "N+K7":
/*!******************************************!*\
  !*** ./src/app/services/http.service.ts ***!
  \******************************************/
/*! exports provided: HttpService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "HttpService", function() { return HttpService; });
/* harmony import */ var tslib__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! tslib */ "mrSG");
/* harmony import */ var _angular_common_http__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/common/http */ "tk/3");
/* harmony import */ var rxjs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! rxjs */ "qCKp");
/* harmony import */ var rxjs_operators__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! rxjs/operators */ "kU1M");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _navigation_service__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ../navigation.service */ "2NUr");







const AUTH_FIREBASE_HEADER = 'X-Authorization-Firebase';
const AUTH_LINK_HEADER = 'X-Authorization-Link';
// batch rate
// https://www.raymondcamden.com/2013/06/06/IndexedDB-and-Date-Example
class HttpService {
    constructor(httpClient, navService) {
        this.httpClient = httpClient;
        this.navService = navService;
        this.isPending = false;
        // different db name for different profile
        this.openReq = indexedDB.open('myscoutee_db', 1);
        this.openReq.onsuccess = (e) => {
            this.db = e.target.result;
        };
        this.openReq.onupgradeneeded = (e) => {
            this.db = e.target.result;
            if (!this.db.objectStoreNames.contains('likes')) {
                var os = this.db.createObjectStore('likes', { autoIncrement: true });
                os.createIndex('created', 'created', { unique: false });
            }
        };
        //batch like
        /*setInterval(() => {
          this.sync();
        }, 30000);*/
    }
    // private REST_API_SERVER = 'http://localhost:4200';
    get(urlPart, params = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpParams"]()) {
        let headers = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpHeaders"]();
        if (this.navService.token !== undefined) {
            headers = headers.append(AUTH_FIREBASE_HEADER, this.navService.token);
        }
        if (this.navService.xlink !== undefined) {
            headers = headers.append(AUTH_LINK_HEADER, this.navService.xlink);
        }
        return this.httpClient
            .get(location.origin + '/backend' + urlPart, { headers, params })
            .pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_3__["catchError"])(this.handleError));
    }
    index(like) {
        let objStore = this.db
            .transaction(['likes'], 'readwrite')
            .objectStore('likes');
        like.rate++;
        objStore.add({ created: new Date(), like });
    }
    sync() {
        return new Promise((resolve, reject) => {
            if (!this.isPending) {
                this.batch().then((res) => {
                    if (res.length === 0) {
                        resolve({});
                    }
                    this.isPending = true;
                    let headers = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpHeaders"]();
                    headers = headers.append(AUTH_FIREBASE_HEADER, this.navService.token);
                    this.httpClient
                        .post(location.origin + '/backend/profiles/like', res, {
                        headers,
                    })
                        .pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_3__["catchError"])(this.handleError))
                        .subscribe({
                        error: (error) => {
                            this.isPending = false;
                            console.log("Can't save!");
                            reject({});
                        },
                        complete: () => {
                            const objStore = this.db
                                .transaction(['likes'], 'readwrite')
                                .objectStore('likes');
                            let range = IDBKeyRange.upperBound(this.toDate);
                            objStore.delete(range);
                            this.isPending = false;
                            resolve({});
                        },
                    });
                });
            }
        });
    }
    batch() {
        return Object(tslib__WEBPACK_IMPORTED_MODULE_0__["__awaiter"])(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                const objStore = this.db
                    .transaction(['likes'], 'readonly')
                    .objectStore('likes');
                let index = objStore.index('created');
                this.toDate = new Date();
                let result = new Array();
                let range = IDBKeyRange.upperBound(this.toDate);
                index.openCursor(range).onsuccess = (e) => {
                    var cursor = e.target.result;
                    if (cursor) {
                        result.push(cursor.value['like']);
                        cursor.continue();
                    }
                    else {
                        resolve(result);
                    }
                };
            });
        });
    }
    save(urlPart, body, params = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpParams"]()) {
        const lastPart = urlPart.substr(urlPart.lastIndexOf('/') + 1);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (lastPart.match(uuidRegex) !== null) {
            return this.patch(urlPart, body, params);
        }
        else {
            return this.post(urlPart, body, params);
        }
    }
    delete(urlPart, params = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpParams"]()) {
        let headers = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpHeaders"]();
        headers = headers.append(AUTH_FIREBASE_HEADER, this.navService.token);
        return this.httpClient
            .delete(location.origin + '/backend' + urlPart, { headers, params })
            .pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_3__["catchError"])(this.handleError));
    }
    post(urlPart, body, params = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpParams"]()) {
        let headers = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpHeaders"]();
        headers = headers.append(AUTH_FIREBASE_HEADER, this.navService.token);
        return this.httpClient
            .post(location.origin + '/backend' + urlPart, body, { headers, params })
            .pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_3__["catchError"])(this.handleError));
    }
    patch(urlPart, body, params = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpParams"]()) {
        let headers = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpHeaders"]();
        headers = headers.append(AUTH_FIREBASE_HEADER, this.navService.token);
        return this.httpClient
            .patch(location.origin + '/backend' + urlPart, body, { headers, params })
            .pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_3__["catchError"])(this.handleError));
    }
    upload(urlPart, body, params = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpParams"]()) {
        let headers = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpHeaders"]();
        headers = headers.append(AUTH_FIREBASE_HEADER, this.navService.token);
        return this.httpClient
            .post(location.origin + '/backend/' + urlPart, body, {
            headers,
            params,
            reportProgress: true,
            observe: 'events',
        })
            .pipe(Object(rxjs_operators__WEBPACK_IMPORTED_MODULE_3__["catchError"])(this.handleError));
    }
    handleError(error) {
        let errorMessage = 'Unknown error!';
        if (error.error instanceof ErrorEvent) {
            // Client-side errors
            errorMessage = `Error: ${error.error.message}`;
        }
        else {
            // Server-side errors
            errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
        }
        console.log(errorMessage);
        return Object(rxjs__WEBPACK_IMPORTED_MODULE_2__["throwError"])(error.error);
    }
}
HttpService.ɵfac = function HttpService_Factory(t) { return new (t || HttpService)(_angular_core__WEBPACK_IMPORTED_MODULE_4__["ɵɵinject"](_angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpClient"]), _angular_core__WEBPACK_IMPORTED_MODULE_4__["ɵɵinject"](_navigation_service__WEBPACK_IMPORTED_MODULE_5__["NavigationService"])); };
HttpService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_4__["ɵɵdefineInjectable"]({ token: HttpService, factory: HttpService.ɵfac, providedIn: 'root' });


/***/ }),

/***/ "NRQz":
/*!*******************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/index.ts ***!
  \*******************************************/
/*! exports provided: HEART_DELTA, HEART_FRAME, SvgLoad, MsFrame */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "HEART_DELTA", function() { return HEART_DELTA; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "HEART_FRAME", function() { return HEART_FRAME; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MsFrame", function() { return MsFrame; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _svg_path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./svg-path */ "g+xa");
/* harmony import */ var _repositories__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./repositories */ "f0P/");
/* harmony import */ var _repositories_utils__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./repositories/utils */ "kVHy");
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _svg_load__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./svg-load */ "4lXa");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "SvgLoad", function() { return _svg_load__WEBPACK_IMPORTED_MODULE_6__["SvgLoad"]; });








const _c0 = ["path"];
const _c1 = ["svg"];
const _c2 = ["wrapper"];
const _c3 = ["handle"];
const _c4 = ["pointHandle"];
function MsFrame_ng_container_2__svg_svg_2__svg_use_6_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnamespaceSVG"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "use", 12);
} if (rf & 2) {
    const ctx_r7 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵattribute"]("stroke-dashoffset", ctx_r7.percentRange.from)("stroke-dasharray", ctx_r7.percentRange.to);
} }
function MsFrame_ng_container_2__svg_svg_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnamespaceSVG"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "svg", 6, 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](2, "g");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](3, "path", 8, 9);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](5, "use", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](6, MsFrame_ng_container_2__svg_svg_2__svg_use_6_Template, 1, 2, "use", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r2 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](6);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r2.highlighted);
} }
function MsFrame_ng_container_2_div_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](0, "div", 13);
} if (rf & 2) {
    const point_r8 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵstyleProp"]("transform", "translate(" + point_r8.x + "px," + point_r8.y + "px)");
} }
const _c5 = function (a0, a1) { return { obj_selected: a0, obj_picked: a1 }; };
function MsFrame_ng_container_2_div_4_div_1_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 15, 16);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const hPt_r10 = ctx.$implicit;
    const ctx_r9 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵstyleProp"]("transform", ctx_r9.sanitize("translate(" + hPt_r10.x + "px," + hPt_r10.y + "px)" + (hPt_r10.picked ? " scale(1.5,1.5)" : "")))("pointer-events", hPt_r10.selected ? "none" : "auto");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵpureFunction2"](7, _c5, !hPt_r10.picked && hPt_r10.selected, hPt_r10.picked))("id", ctx_r9.id + hPt_r10.id);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtextInterpolate"](hPt_r10.txt);
} }
function MsFrame_ng_container_2_div_4_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](1, MsFrame_ng_container_2_div_4_div_1_Template, 3, 10, "div", 14);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r4 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngForOf", ctx_r4.handles);
} }
function MsFrame_ng_container_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerStart"](1, 3);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](2, MsFrame_ng_container_2__svg_svg_2_Template, 7, 1, "svg", 4);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](3, MsFrame_ng_container_2_div_3_Template, 1, 2, "div", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](4, MsFrame_ng_container_2_div_4_Template, 2, 1, "div", 2);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementContainerEnd"]();
} if (rf & 2) {
    const ctx_r1 = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngSwitch", ctx_r1.data.type);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngSwitchCase", "HEART");
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngForOf", ctx_r1.points);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx_r1.segment);
} }
const HEART_DELTA = 36; //deg
const HEART_FRAME = {
    type: 'HEART',
    limit: { min: 0, max: 10 },
    num: 5,
    delta: HEART_DELTA,
};

/*
"svg": {
                "url": "", //svg foreign-object svg url - can render div to canvas
                "delta": "", //alignment value, where the first button has been placed - calculate whether the line is closed or opened - first and last value is the same
                "func":"" //distribution method
            }, //type : freeform - extrenal link - https://greensock.com/forums/topic/11187-accessing-svg-paths-in-external-file/
            "fab": true, //no background, mouse-pointer: none
*/
/* bugs
 * 1, limit cannot be overflown
 * 2, when first handle touches second one, is going forward without the second one in some cases
 * 3, blue line is getting updated
 * 4, put ruler marker lines on the path (half / quater is thicker)
 */
class MsFrame {
    constructor(_renderer, cd, sanitizer) {
        this._renderer = _renderer;
        this.cd = cd;
        this.sanitizer = sanitizer;
        this.isGroup = false;
        this.entered = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this.leaved = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this.changed = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this.isInitialized = false;
        this.handles = new Array();
    }
    sanitize(style) {
        return this.sanitizer.bypassSecurityTrustStyle(style);
    }
    ngOnInit() {
        this.frame_width = 100;
        this.isPicked = false;
        this.isPickedMoved = false;
        if (this.type === 'path') {
            this.data = HEART_FRAME;
            this.data.closed = true;
            if (this.data.delta === undefined) {
                this.data.delta = HEART_DELTA;
            }
            this.cd.detectChanges();
            this.distribute();
            this.cd.detectChanges();
        }
        this.init();
    }
    ngAfterViewInit() { }
    remove(idx) {
        this.handles.splice(idx, 1);
    }
    init() {
        if (!this.isInitialized) {
            /*this.handleRef.forEach((handle, index) => {
              this.initHandle(index, handle.nativeElement);
            });*/
            // with document - preventDefault should be removed
            // touch events is not triggered while dragging to a different frame,
            // only document.elementFromPoint simulates whther the mouse it's on an other frame!!!
            this._renderer.listen(this.wrapper.nativeElement, 'touchstart', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (this.offset === undefined) {
                    this.offset = this.wrapper.nativeElement.getBoundingClientRect();
                    this.pointHandleRef.forEach((handle, i) => {
                        const rect = handle.nativeElement.getBoundingClientRect();
                        this.points[i].x = rect.x;
                        this.points[i].y = rect.y;
                    });
                }
                const touch = event.targetTouches[0];
                this.selectedDiv = document.elementFromPoint(touch.clientX, touch.clientY);
                const handleIdx = parseInt(this.selectedDiv.textContent, 10);
                if (isNaN(handleIdx)) {
                    return false;
                }
                this.handles[handleIdx].selected = true;
                this.handleGroup(handleIdx);
                this.pressTimer = window.setTimeout(() => {
                    this.handles[handleIdx].picked = true;
                    this.handleGroup(handleIdx);
                    this.isPicked = true;
                }, 500);
            });
            this._renderer.listen(this.wrapper.nativeElement, 'touchmove', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const handleIdx = parseInt(this.selectedDiv.textContent, 10);
                if (isNaN(handleIdx)) {
                    return false;
                }
                clearTimeout(this.pressTimer);
                if (this.isPickedMoved) {
                    this.handles[handleIdx].picked = false;
                }
                else {
                    this.pressTimer = window.setTimeout(() => {
                        this.handles[handleIdx].picked = true;
                        this.isPicked = true;
                    }, 500);
                }
                const touch = event.targetTouches[0];
                const div = document.elementFromPoint(touch.clientX, touch.clientY);
                const classList = div !== undefined && div !== null && div.classList;
                if (classList.contains !== undefined &&
                    classList.contains('f_hover')) {
                    this.entered.emit(div);
                }
                //removing pointer events - the underneath element has been selected
                if (this.selectedDiv !== undefined) {
                    const ptOffset = {
                        x: touch.clientX - this.offset.x,
                        y: touch.clientY - this.offset.y,
                    };
                    if (this.isPicked) {
                        this.handles[handleIdx].x = ptOffset.x;
                        this.handles[handleIdx].y = ptOffset.y;
                        this.handles[handleIdx].picked = true;
                    }
                    let pointIdx;
                    let minDistance = Infinity;
                    //it was this.segment._points.length for path
                    for (let i = 0; i < this.points.length; i++) {
                        const distance = _repositories_utils__WEBPACK_IMPORTED_MODULE_3__["Calc"].distance2(this.points[i], ptOffset);
                        if (minDistance > distance) {
                            minDistance = distance;
                            pointIdx = i;
                        }
                    }
                    if (this.type === 'path') {
                        /*
                      moving group to bigger value direction which has got some lower element, realizes late that the lower value element shouldn't move - not a big issue
                      */
                        if (minDistance > 250) {
                            if (this.handles[handleIdx].picked) {
                                this.handles[handleIdx].x = ptOffset.x;
                                this.handles[handleIdx].y = ptOffset.y;
                            }
                            else {
                                const itp = new _repositories__WEBPACK_IMPORTED_MODULE_2__["Interpolate"](this.segment._path);
                                // this wRatio thing on pageX is crazy, no idea why it's working
                                const pt = {
                                    x: (touch.clientX - this.offset.x) /
                                        this.segment._bound.wRatio,
                                    y: (touch.clientY - this.offset.y) /
                                        this.segment._bound.hRatio,
                                };
                                const result = itp.nearby(undefined, pt, undefined);
                                const loc = result.point;
                                loc.x *= this.segment._bound.wRatio;
                                loc.y *= this.segment._bound.hRatio;
                                this.handles[handleIdx].x = loc.x;
                                this.handles[handleIdx].y = loc.y;
                                if (this.handles[handleIdx].value !== pointIdx) {
                                    this.handleGroup(handleIdx, pointIdx);
                                }
                                this.handles[handleIdx].value = pointIdx;
                                this.isPickedMoved = true;
                            }
                            this.handleGroup(handleIdx);
                        }
                        else {
                            // TODO: check if the handle has been moved by pointIdx !== this.handles[handleIdx].value
                            this.handles[handleIdx].x = this.points[pointIdx].x;
                            this.handles[handleIdx].y = this.points[pointIdx].y;
                            this.handles[handleIdx].picked = false;
                            this.handleGroup(handleIdx, pointIdx);
                            this.handles[handleIdx].value = pointIdx;
                            this.isPickedMoved = true;
                        }
                        this.changed.emit(pointIdx);
                    }
                }
            });
            this._renderer.listen(this.wrapper.nativeElement, 'touchend', (event) => {
                event.preventDefault();
                event.stopPropagation();
                clearTimeout(this.pressTimer);
                if (this.selectedDiv !== undefined) {
                    this.leaved.emit();
                    const handleIdx = parseInt(this.selectedDiv.textContent, 10);
                    if (isNaN(handleIdx)) {
                        return false;
                    }
                    const touch = event.changedTouches[0];
                    const ptOffset = {
                        x: touch.clientX - this.offset.x,
                        y: touch.clientY - this.offset.y,
                    };
                    if (this.type === 'path') {
                        let pointIdx;
                        let minDistance = Infinity;
                        for (let i = 0; i < this.segment._points.length; i++) {
                            let distance = _repositories_utils__WEBPACK_IMPORTED_MODULE_3__["Calc"].distance2(this.segment._points[i], ptOffset);
                            if (minDistance > distance) {
                                minDistance = distance;
                                pointIdx = i;
                            }
                        }
                        if (this.handles[handleIdx].picked) {
                            if (minDistance <= 500) {
                                this.handles[handleIdx].picked = false;
                            }
                        }
                        if (!this.handles[handleIdx].picked) {
                            this.handles[handleIdx].x = this.segment._points[pointIdx].x;
                            this.handles[handleIdx].y = this.segment._points[pointIdx].y;
                            this.handles[handleIdx].value = pointIdx;
                            this.changed.emit(pointIdx);
                        }
                    }
                    this.handles[handleIdx].selected = false;
                    this.handleGroup(handleIdx);
                    this.isPickedMoved = false;
                    this.isPicked = false;
                    this.selectedDiv = undefined;
                    this.nextPointIdx = undefined;
                    this.isPrevUp = undefined;
                }
            });
            this.isInitialized = true;
        }
    }
    handleGroup(handleIdx, pointIdx) {
        if (!this.isGroup) {
            if (pointIdx === undefined)
                return;
            let hasOverlay = false;
            for (let i = 0; i < this.handles.length; i++) {
                if (this.handles[i].value === pointIdx) {
                    hasOverlay = true;
                    break;
                }
            }
            let sectionNum = this.points.length;
            let isUp = this.nextPointIdx === pointIdx
                ? this.isPrevUp
                : this.nextPointIdx !== undefined
                    ? pointIdx > this.nextPointIdx
                    : pointIdx > this.handles[handleIdx].value;
            if (pointIdx !== this.handles[handleIdx].value) {
                if (isUp) {
                    for (let i = 0; i < this.handles.length; i++) {
                        if (hasOverlay && handleIdx !== i) {
                            let value = (sectionNum + ((this.handles[i].value + 1) % sectionNum)) %
                                sectionNum;
                            this.handles[i].x = this.points[value].x;
                            this.handles[i].y = this.points[value].y;
                            this.handles[i].value = value;
                        }
                    }
                    this.nextPointIdx =
                        (sectionNum + ((pointIdx + 1) % sectionNum)) % sectionNum;
                }
                else {
                    for (let i = 0; i < this.handles.length; i++) {
                        if (hasOverlay && handleIdx !== i) {
                            let value = (sectionNum + ((this.handles[i].value - 1) % sectionNum)) %
                                sectionNum;
                            this.handles[i].x = this.points[value].x;
                            this.handles[i].y = this.points[value].y;
                            this.handles[i].value = value;
                        }
                    }
                    this.nextPointIdx =
                        (sectionNum + ((pointIdx - 1) % sectionNum)) % sectionNum;
                }
                this.isPrevUp = isUp;
            }
        }
        else {
            for (let i = 0; i < this.handles.length; i++) {
                if (i > handleIdx) {
                    if (this.handles[i].value <= this.handles[handleIdx].value) {
                        this.handles[i].x = this.handles[handleIdx].x;
                        this.handles[i].y = this.handles[handleIdx].y;
                        this.handles[i].value = this.handles[handleIdx].value;
                        this.handles[i].selected = this.handles[handleIdx].selected;
                        this.handles[i].picked = this.handles[handleIdx].picked;
                    }
                    else {
                        if (this.handles[i].picked) {
                            if (this.handles[i].value === this.handles[handleIdx].value) {
                                this.handles[i].x =
                                    this.points[this.handles[handleIdx].value].x;
                                this.handles[i].y =
                                    this.points[this.handles[handleIdx].value].y;
                            }
                        }
                        else if (this.handles[i].selected) {
                            this.handles[i].x = this.points[this.handles[i].value].x;
                            this.handles[i].y = this.points[this.handles[i].value].y;
                        }
                        this.handles[i].selected = false;
                    }
                }
                if (i < handleIdx) {
                    if (this.handles[i].value >= this.handles[handleIdx].value) {
                        this.handles[i].x = this.handles[handleIdx].x;
                        this.handles[i].y = this.handles[handleIdx].y;
                        this.handles[i].value = this.handles[handleIdx].value;
                        this.handles[i].selected = this.handles[handleIdx].selected;
                        this.handles[i].picked = this.handles[handleIdx].picked;
                    }
                    else {
                        if (this.handles[i].picked) {
                            if (this.handles[i].value === this.handles[handleIdx].value) {
                                this.handles[i].x =
                                    this.points[this.handles[handleIdx].value].x;
                                this.handles[i].y =
                                    this.points[this.handles[handleIdx].value].y;
                            }
                        }
                        else if (this.handles[i].selected) {
                            this.handles[i].x = this.points[this.handles[i].value].x;
                            this.handles[i].y = this.points[this.handles[i].value].y;
                        }
                        this.handles[i].selected = false;
                    }
                }
            }
        }
    }
    //Two.js - there is an example to follow the line
    initHandle(idx, handle) { }
    distribute() {
        let path = this.path.nativeElement;
        let rect = path.getBoundingClientRect();
        let svg = this.svg.nativeElement;
        let viewBoxVal = svg.viewBox.baseVal;
        let wRatio = rect.width / viewBoxVal.width;
        let hRatio = rect.height / viewBoxVal.height;
        let bound = { rect: rect, wRatio: wRatio, hRatio: hRatio };
        let str = path.getAttribute('d');
        path = new _svg_path__WEBPACK_IMPORTED_MODULE_1__["svgPathProperties"](str);
        this.segment = new _repositories__WEBPACK_IMPORTED_MODULE_2__["Segment"](path, this.data, bound);
        this.points = this.segment._points;
        this.handles = JSON.parse(JSON.stringify(this.segment.handles));
        let rules = this.handles.map((handle, idx) => {
            return ('.mat-tab-label:nth-child(' +
                (idx + 1) +
                ') { --posX: ' +
                handle.x +
                'px; --posY: ' +
                handle.y +
                'px;}');
        });
        this.createCSSClass(rules);
        let fromPart = (2 * path.getTotalLength()) / this.points.length;
        let from = path.getTotalLength() - fromPart;
        //dasharray is tricky - from dashoffset to "100 1790"
        //100 is the length and 1790 is the length of space - it won't add any new section, as there is no space left (1890 is the total length)
        let toPart = (5 * path.getTotalLength()) / this.points.length;
        let to = toPart + ' ' + (path.getTotalLength() - toPart);
        this.percentRange = { from: from, to: to };
    }
    createCSSClass(rules) {
        var style = document.createElement('style');
        style.type = 'text/css';
        document.head.appendChild(style);
        let cssRulesAppended = rules.join(' ');
        style.appendChild(document.createTextNode(cssRulesAppended));
    }
    // resize not working
    onResize() {
        if (this.type === 'path') {
            /*this.offset = this.wrapper.nativeElement.getBoundingClientRect();
      
            let path = this.path.nativeElement;
            let rect = path.getBoundingClientRect();
            let svg = this.svg.nativeElement;
            let viewBoxVal = svg.viewBox.baseVal;
            let wRatio = rect.width / viewBoxVal.width;
            let hRatio = rect.height / viewBoxVal.height;
      
            for (let handle of this.handles) {
              handle.x *= wRatio / this.segment._bound.wRatio;
              handle.y *= hRatio / this.segment._bound.hRatio;
            }
      
            for (let point of this.points) {
              point.x *= wRatio / this.segment._bound.wRatio;
              point.y *= hRatio / this.segment._bound.hRatio;
            }
      
            let rules = this.handles.map((handle, idx) => {
              return ".mat-tab-label:nth-child("+(idx + 1)+") { --posX: "+ handle.x +"px; --posY: " + handle.y + "px;}"
            });
      
            this.createCSSClass(rules);
      
            this.segment._bound.wRatio = wRatio;
            this.segment._bound.hRatio = hRatio;*/
            setTimeout(() => {
                this.distribute();
            }, 1500);
        }
    }
}
MsFrame.ɵfac = function MsFrame_Factory(t) { return new (t || MsFrame)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_0__["Renderer2"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_0__["ChangeDetectorRef"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_platform_browser__WEBPACK_IMPORTED_MODULE_4__["DomSanitizer"])); };
MsFrame.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: MsFrame, selectors: [["ms-frame"]], viewQuery: function MsFrame_Query(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c0, 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c1, 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c2, 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c3, 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c4, 1);
    } if (rf & 2) {
        let _t;
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.path = _t.first);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.svg = _t.first);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.wrapper = _t.first);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.handleRef = _t);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.pointHandleRef = _t);
    } }, hostBindings: function MsFrame_HostBindings(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("resize", function MsFrame_resize_HostBindingHandler() { return ctx.onResize(); }, false, _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵresolveWindow"]);
    } }, inputs: { alias: "alias", data: "data", highlighted: "highlighted", id: "id", type: "type" }, outputs: { entered: "entered", leaved: "leaved", changed: "changed" }, decls: 3, vars: 3, consts: [["id", "frame_wrapper", 1, "frame_wrapper"], ["wrapper", ""], [4, "ngIf"], [3, "ngSwitch"], ["xmlns", "http://www.w3.org/2000/svg", 0, "xmlns", "xlink", "http://www.w3.org/1999/xlink", "width", "100%", "height", "100%", "viewBox", "0 0 610 610", "preserveAspectRatio", "none", 4, "ngSwitchCase"], ["class", "tick", 3, "transform", 4, "ngFor", "ngForOf"], ["xmlns", "http://www.w3.org/2000/svg", 0, "xmlns", "xlink", "http://www.w3.org/1999/xlink", "width", "100%", "height", "100%", "viewBox", "0 0 610 610", "preserveAspectRatio", "none"], ["svg", ""], ["id", "heart", "d", "m 299.94115,90.723541 c 43.85146,-53.835957 84.90475,-74.209502 131.8675,-73.865659 70.16102,0.546061 \n          131.15187,53.896586 155.66311,116.074948 23.33268,59.18867 7.9402,134.66216 -29.74454,189.94083 C 516.0371,384.02768 \n          358.18433,520.02065 299.94115,605.67445 241.69801,520.02065 83.845233,384.02768 42.15512,322.87366 4.4703613,267.59499 \n          -10.922109,192.12151 12.410575,132.93283 36.92182,70.754473 97.912659,17.403942 168.07369,16.857882 215.03643,16.514039 \n          256.08971,36.887584 299.94115,90.723541 Z", "fill", "none"], ["path", ""], [0, "xlink", "href", "#heart", "stroke-width", "1", "stroke", "black"], [0, "xlink", "href", "#heart", "stroke-width", "16", "stroke", "#387ef5", 4, "ngIf"], [0, "xlink", "href", "#heart", "stroke-width", "16", "stroke", "#387ef5"], [1, "tick"], ["class", "obj", 3, "ngClass", "transform", "id", "pointer-events", 4, "ngFor", "ngForOf"], [1, "obj", 3, "ngClass", "id"], ["handle", ""]], template: function MsFrame_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 0, 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵtemplate"](2, MsFrame_ng_container_2_Template, 5, 4, "ng-container", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵstyleProp"]("width", ctx.frame_width, "%");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("ngIf", ctx.type === "path");
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_5__["NgIf"], _angular_common__WEBPACK_IMPORTED_MODULE_5__["NgSwitch"], _angular_common__WEBPACK_IMPORTED_MODULE_5__["NgSwitchCase"], _angular_common__WEBPACK_IMPORTED_MODULE_5__["NgForOf"], _angular_common__WEBPACK_IMPORTED_MODULE_5__["NgClass"]], encapsulation: 2 });


/***/ }),

/***/ "Re8X":
/*!**********************************!*\
  !*** ./src/lib/ms-menu/index.ts ***!
  \**********************************/
/*! exports provided: HEART_DELTA, HEART_FRAME, SvgLoad, MsFrame, MsMenu */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MsMenu", function() { return MsMenu; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _ms_frame_index__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./ms-frame/index */ "NRQz");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "HEART_DELTA", function() { return _ms_frame_index__WEBPACK_IMPORTED_MODULE_1__["HEART_DELTA"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "HEART_FRAME", function() { return _ms_frame_index__WEBPACK_IMPORTED_MODULE_1__["HEART_FRAME"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "SvgLoad", function() { return _ms_frame_index__WEBPACK_IMPORTED_MODULE_1__["SvgLoad"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsFrame", function() { return _ms_frame_index__WEBPACK_IMPORTED_MODULE_1__["MsFrame"]; });




const _c0 = ["hover"];

class MsMenu {
    constructor(_renderer) {
        this._renderer = _renderer;
    }
    onEntered(div) {
        if (this.selectedDiv !== undefined && this.selectedDiv !== div) {
            let obj = this.hovers.find((hover) => hover instanceof _angular_core__WEBPACK_IMPORTED_MODULE_0__["ElementRef"]
                ? hover.nativeElement.id === this.selectedDiv.id
                : hover['id'] === this.selectedDiv.id);
            if (obj && !(obj instanceof _angular_core__WEBPACK_IMPORTED_MODULE_0__["ElementRef"])) {
                obj.highlighted = false;
            }
            else {
                this._renderer.removeClass(this.selectedDiv, 'f_hover_highlighted');
            }
            this.selectedDiv = undefined;
        }
        let classList = div !== undefined && div !== null && div.classList;
        if (classList.contains('f_hover')) {
            let obj = this.hovers.find((hover) => hover instanceof _angular_core__WEBPACK_IMPORTED_MODULE_0__["ElementRef"]
                ? hover.nativeElement.id === div.id
                : hover['id'] === div.id);
            if (obj && !(obj instanceof _angular_core__WEBPACK_IMPORTED_MODULE_0__["ElementRef"])) {
                obj.highlighted = true;
            }
            else {
                this._renderer.addClass(div, 'f_hover_highlighted');
            }
            this.selectedDiv = div;
        }
    }
    onLeaved() {
        if (this.selectedDiv !== undefined) {
            let obj = this.hovers.find((hover) => hover instanceof _angular_core__WEBPACK_IMPORTED_MODULE_0__["ElementRef"]
                ? hover.nativeElement.id === this.selectedDiv.id
                : hover['id'] === this.selectedDiv.id);
            if (obj && !(obj instanceof _angular_core__WEBPACK_IMPORTED_MODULE_0__["ElementRef"])) {
                obj.highlighted = false;
            }
            else {
                this._renderer.removeClass(this.selectedDiv, 'f_hover_highlighted');
            }
            this.selectedDiv = undefined;
        }
    }
    //style binding should be reduced, so style attribute should be generated in javascript unfortunatelly
    //https://css-tricks.com/transitions-only-after-page-load/
    //it might not be scale, maybe the whole thing willbe a translate up - like slide menu on android!!
    //cannot do [style.--translate], so css variable use has been removed
    //removing menu - full screen mode - the panel transform-origin: center center
    //https://css-tricks.com/almanac/properties/t/transform-origin/ - very nice example
    ngOnInit() {
        //it's not needed, as we are not moving out container until the mouseUp is not triggered
        /*this._renderer.listen(document, "touchmove", (event) => {
                event.stopPropagation();
    
                let handle = this.overlayRef.nativeElement.children[0];
    
                let touch = event.targetTouches[0];
                let translateStr = "translate(" + (touch.pageX - handle.clientWidth / 2) + "px," + (touch.pageY - handle.clientHeight / 2) + "px)";
                this._renderer.setStyle(handle, "transform", translateStr);
            });*/
    }
}
MsMenu.ɵfac = function MsMenu_Factory(t) { return new (t || MsMenu)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_0__["Renderer2"])); };
MsMenu.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: MsMenu, selectors: [["ms-menu"]], viewQuery: function MsMenu_Query(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c0, 1);
    } if (rf & 2) {
        let _t;
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.hovers = _t);
    } }, decls: 5, vars: 3, consts: [[1, "f_panel"], ["id", "frame2", 1, "f_hover", "f_hover_translated", 3, "type", "entered", "leaved"], ["hover", ""], ["id", "overlay", 1, "f_overlay"], ["overlay", ""]], template: function MsMenu_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](1, "ms-frame", 1, 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("entered", function MsMenu_Template_ms_frame_entered_1_listener($event) { return ctx.onEntered($event); })("leaved", function MsMenu_Template_ms_frame_leaved_1_listener() { return ctx.onLeaved(); });
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelement"](3, "div", 3, 4);
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵstyleProp"]("overflow", "visible");
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("type", "path");
    } }, directives: [_ms_frame_index__WEBPACK_IMPORTED_MODULE_1__["MsFrame"]], encapsulation: 2 });


/***/ }),

/***/ "SvDg":
/*!**********************************!*\
  !*** ./src/lib/ms-list/index.ts ***!
  \**********************************/
/*! exports provided: MsAction, MsCalendar, MsPanel, MsList */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MsList", function() { return MsList; });
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _angular_common_http__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/common/http */ "tk/3");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _angular_router__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/router */ "tyNb");
/* harmony import */ var rxjs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! rxjs */ "qCKp");
/* harmony import */ var src_app_dating_components_forms_group_filter_group_filter_component__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! src/app/dating/components/forms/group-filter/group-filter.component */ "dcXB");
/* harmony import */ var _ms_dialog__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ../ms-dialog */ "a6ou");
/* harmony import */ var _app_app_routing_strategy__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../app/app-routing.strategy */ "fJWI");
/* harmony import */ var _ms_panel__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./ms-panel */ "+KWR");
/* harmony import */ var _angular_material_dialog__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @angular/material/dialog */ "0IaG");
/* harmony import */ var src_app_navigation_service__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! src/app/navigation.service */ "2NUr");
/* harmony import */ var src_app_services_http_service__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! src/app/services/http.service */ "N+K7");
/* harmony import */ var src_app_services_transform_service__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! src/app/services/transform.service */ "46oZ");
/* harmony import */ var src_app_services_list_service__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! src/app/services/list.service */ "YoPC");
/* harmony import */ var _angular_material_snack_bar__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @angular/material/snack-bar */ "dNgK");
/* harmony import */ var _angular_material_progress_bar__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @angular/material/progress-bar */ "bv9b");
/* harmony import */ var _angular_material_icon__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @angular/material/icon */ "NFeN");
/* harmony import */ var _angular_material_button__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @angular/material/button */ "bTqV");
/* harmony import */ var _angular_material_core__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @angular/material/core */ "FKr1");
/* harmony import */ var _ms_calendar_index__WEBPACK_IMPORTED_MODULE_19__ = __webpack_require__(/*! ./ms-calendar/index */ "BKi+");
/* harmony import */ var _ms_action__WEBPACK_IMPORTED_MODULE_20__ = __webpack_require__(/*! ./ms-action */ "JCxZ");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsAction", function() { return _ms_action__WEBPACK_IMPORTED_MODULE_20__["MsAction"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsCalendar", function() { return _ms_calendar_index__WEBPACK_IMPORTED_MODULE_19__["MsCalendar"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsPanel", function() { return _ms_panel__WEBPACK_IMPORTED_MODULE_8__["MsPanel"]; });

























const _c0 = ["items"];
const _c1 = ["divider"];
const _c2 = ["calendar"];
const _c3 = ["overlay"];
const _c4 = ["oldOverlay"];
function MsList_mat_icon_2_Template(rf, ctx) { if (rf & 1) {
    const _r12 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "mat-icon", 15);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵlistener"]("click", function MsList_mat_icon_2_Template_mat_icon_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵrestoreView"](_r12); const ctx_r11 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"](); return ctx_r11.setting(); });
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](1, "settings");
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} }
function MsList_div_4_Template(rf, ctx) { if (rf & 1) {
    const _r14 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "div", 16);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](1, "ms-panel", 17);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵlistener"]("msRemove", function MsList_div_4_Template_ms_panel_msRemove_1_listener($event) { _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵrestoreView"](_r14); const ctx_r13 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"](); return ctx_r13.onDelete($event); });
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r1 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("alias", ctx_r1.overlayData.id)("data", ctx_r1.overlayData)("removable", ctx_r1.overlayData.removable !== undefined ? ctx_r1.overlayData.removable : true);
} }
function MsList_ng_container_8_button_1_Template(rf, ctx) { if (rf & 1) {
    const _r20 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "button", 19);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵlistener"]("click", function MsList_ng_container_8_button_1_Template_button_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵrestoreView"](_r20); const idx_r16 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]().index; const ctx_r18 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"](); return ctx_r18.openDialog(idx_r16); });
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](1, "mat-icon");
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const action_r15 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]().$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("color", action_r15.color ? action_r15.color : "primary");
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtextInterpolate"](action_r15.icon);
} }
function MsList_ng_container_8_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementContainerStart"](0);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](1, MsList_ng_container_8_button_1_Template, 3, 2, "button", 18);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementContainerEnd"]();
} if (rf & 2) {
    const action_r15 = ctx.$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", action_r15.icon !== undefined);
} }
const _c5 = function (a0) { return { "mat-button-active": a0 }; };
function MsList_div_14_div_1_Template(rf, ctx) { if (rf & 1) {
    const _r26 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "div");
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](1, "div", 21);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵlistener"]("click", function MsList_div_14_div_1_Template_div_click_1_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵrestoreView"](_r26); const idx_r24 = ctx.index; const ctx_r25 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"](2); return ctx_r25.onRate(idx_r24); });
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](2, "mat-icon", 22);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](3, "star_rate");
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const idx_r24 = ctx.index;
    const ctx_r22 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵpureFunction1"](2, _c5, idx_r24 <= ctx_r22.rate));
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("fontSet", idx_r24 <= ctx_r22.rate ? "material-icons" : "material-icons-outlined");
} }
function MsList_div_14_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "div", 20);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](1, MsList_div_14_div_1_Template, 4, 4, "div", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r6 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngForOf", ctx_r6.numSequence(10));
} }
function MsList_ng_template_15_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "div", 23);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const title_r27 = ctx.title;
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtextInterpolate1"]("\u00A0\u00A0", title_r27, "");
} }
function MsList_ng_template_17_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](0, "ms-calendar", 24);
} if (rf & 2) {
    const data_r28 = ctx.data;
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("data", data_r28);
} }
const _c6 = function (a0) { return { "snap": a0 }; };



const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];
//import("./ms-panel").then(({MsPanel}) => {}
//1) copy to canvas at upload - resize img android native
//2) latch only map - and for one panel only
//3) draggable / dragzone polyfill for touch screen
//list_panel_30 - conf.json - 30 view buffer
//https://developers.google.com/web/updates/2017/11/overscroll-behavior
//paging - scroll page up / down
const MAX_INT = 2147483647;
const injector = _angular_core__WEBPACK_IMPORTED_MODULE_2__["Injector"].create({
    providers: [{ provide: _ms_panel__WEBPACK_IMPORTED_MODULE_8__["MsPanel"], deps: [] }, { provide: _angular_common__WEBPACK_IMPORTED_MODULE_0__["DatePipe"] }],
});
const pairRate = {
    type: 'route',
    icon: 'people_outline',
    url: '/games/rate_double',
};
const actionMap = {
    L: 'leave',
    R: 'reject',
    A: 'accept',
    P: 'publish',
    CA: 'leave',
    W: 'wait',
};
class MsList {
    constructor(resolver, _renderer, router, activatedRoute, dialog, navService, httpService, transformService, datePipe, cd, listService, _snackBar) {
        this.resolver = resolver;
        this._renderer = _renderer;
        this.router = router;
        this.activatedRoute = activatedRoute;
        this.dialog = dialog;
        this.navService = navService;
        this.httpService = httpService;
        this.transformService = transformService;
        this.datePipe = datePipe;
        this.cd = cd;
        this.listService = listService;
        this._snackBar = _snackBar;
        this.msSelect = new _angular_core__WEBPACK_IMPORTED_MODULE_2__["EventEmitter"]();
        this.msDelete = new _angular_core__WEBPACK_IMPORTED_MODULE_2__["EventEmitter"]();
        this.progress = { mode: 'determine', value: 0, color: 'primary' };
        this.isRefreshing = false;
        this.isLoading = false;
        this.offsetTop = 0;
        this.direction = 1;
        this.touched = false;
        this.isRefreshed = false;
        this.isSelected = false;
        this.scrollTop = 0;
        this.items = new Array();
        this.selectedItems = new Array();
        this.sortedItems = new Array();
        this.isOverlay = false;
        this.multiple = false;
        this.double = false;
        this.isEvent = false; //temporary
        this.group = undefined;
        this.range = { from: new Date(), to: new Date() };
        this.rangeDist = { from: 0, to: 0 };
        //temporary
        this.currentFrom = new Date();
        this.isPull = false;
        this.isAdmin = false;
        this.share = this.listService.share.subscribe({
            next: (evt) => {
                const idx = this.actions.findIndex((action) => action.type === 'share');
                this.openDialog(idx, evt.alias);
            },
        });
        this.join = this.listService.join.subscribe({
            next: (evt) => {
                const url = this.items[evt.alias].info.url.substring(1);
                const itemUrl = url.substring(url.indexOf('/'));
                this.httpService.save(itemUrl + '/join', {}).subscribe({
                    next: (result) => {
                        this._snackBar.open('You successfully joined to "' +
                            this.items[evt.alias].info.header.main +
                            '"!', undefined, { duration: 1500 });
                    },
                    error: (error) => {
                        this.progress.mode = 'determine';
                        this.progress.color = 'warn';
                    },
                    complete: () => {
                        this.reset();
                        console.log('complete');
                    },
                });
            },
        });
        this.delete = this.listService.delete.subscribe({
            next: (evt) => {
                const url = this.items[evt.alias].info.url.substring(1);
                const itemUrl = url.substring(url.indexOf('/'));
                this.httpService.delete(itemUrl).subscribe({
                    next: (result) => {
                        this._snackBar.open('"' +
                            this.items[evt.alias].info.header.main +
                            '" has been sucessfully deleted!', undefined, { duration: 1500 });
                    },
                    error: (error) => {
                        if (error && error.key !== undefined) {
                            if (this.navService.locale !== undefined) {
                                const msg = this.navService.locale[error.value];
                                this._snackBar.open(msg, undefined, { duration: 1500 });
                            }
                        }
                        this.progress.mode = 'determine';
                        this.progress.color = 'warn';
                    },
                    complete: () => {
                        this.reset();
                        console.log('complete');
                    },
                });
            },
        });
        this.recommend = this.listService.recommend.subscribe({
            next: (evt) => {
                const url = this.items[evt.alias].info.url.substring(1);
                const itemUrl = url.substring(url.indexOf('/'));
                this.httpService.save(itemUrl + '/recommend', {}).subscribe({
                    next: (result) => {
                        this._snackBar.open('The "' +
                            this.items[evt.alias].info.header.main +
                            '" has been successfully recommended!', undefined, { duration: 1500 });
                    },
                    error: (error) => {
                        this.progress.mode = 'determine';
                        this.progress.color = 'warn';
                    },
                    complete: () => {
                        console.log('complete');
                    },
                });
            },
        });
        this.clone = this.listService.clone.subscribe({
            next: (evt) => {
                const url = this.items[evt.alias].info.url.substring(1);
                const itemUrl = url.substring(url.indexOf('/'));
                this.httpService.save(itemUrl + '/clone', {}).subscribe({
                    next: (result) => {
                        this._snackBar.open(this.items[evt.alias].info.header.main + ' has been clone!', undefined, { duration: 1500 });
                    },
                    error: (error) => {
                        this.progress.mode = 'determine';
                        this.progress.color = 'warn';
                    },
                    complete: () => {
                        console.log('complete');
                    },
                });
            },
        });
        this.dialogSub = this.listService.dialog.subscribe({
            next: (evt) => {
                const listUrl = evt.itemUrl.substring(0, evt.itemUrl.lastIndexOf('/'));
                if (listUrl === this.itemUrl) {
                    const idx = this.actions.findIndex((action) => action.type === 'list');
                    const url = evt.itemUrl.substring(1);
                    const itemUrl = url.substring(url.indexOf('/'));
                    this.openDialog(idx, undefined, itemUrl + '/items');
                }
            },
        });
        this.status = this.listService.status.subscribe({
            next: (evt) => {
                const info = this.items[evt.alias].info;
                const url = info.url.substring(1);
                const itemUrl = url.substring(url.indexOf('/'));
                if (evt.action === 'L' || evt.action === 'CA') {
                    this.leave(info.name, info.isPromotion).then((resp) => {
                        if (resp === true) {
                            this.doStatus(itemUrl, evt);
                        }
                    });
                }
                else {
                    this.doStatus(itemUrl, evt);
                }
            },
        });
        this.edit = this.listService.edit.subscribe({
            next: (evt) => {
                const idx = this.actions.findIndex((action) => action.type === 'edit');
                this.openDialog(idx, evt.alias);
            },
        });
        this.code = this.listService.code.subscribe({
            next: (evt) => {
                const idx = this.actions.findIndex((action) => action.type === 'code');
                this.openDialog(idx, evt.alias);
            },
        });
        this.listService.overlay.subscribe({
            next: (evt) => {
                this.overlayData = evt;
            },
        });
        this.navService.online.subscribe({
            next: (evt) => {
                if (!evt.online) {
                    this.lastProgressState = this.progress.color;
                    this.progress = {
                        mode: this.progress.mode,
                        value: this.progress.value,
                        color: 'accent',
                    };
                }
                else {
                    this.progress = {
                        mode: this.progress.mode,
                        value: this.progress.value,
                        color: this.lastProgressState,
                    };
                    this.lastProgressState = undefined;
                }
            },
        });
        router.events.subscribe((event) => {
            if (event instanceof _angular_router__WEBPACK_IMPORTED_MODULE_3__["NavigationEnd"]) {
                const inbox = this.itemsRef.element.nativeElement.parentElement.parentElement;
                inbox.scrollTo({ top: this.scrollTop });
            }
        });
    }
    reset() {
        this.items = new Array();
        this.selectedItems = new Array();
        this.sortedItems = new Array();
        this.offset = undefined;
        this.itemsRef.clear();
        setTimeout(() => {
            let inbox = this.itemsRef.element.nativeElement.parentElement.parentElement;
            this.updatePage(inbox, false);
        });
    }
    doStatus(itemUrl, evt) {
        this.httpService.save(itemUrl + '/' + actionMap[evt.action], {}).subscribe({
            next: (result) => {
                this.reset();
            },
            error: (error) => {
                this.progress.mode = 'determine';
                this.progress.color = 'warn';
            },
            complete: () => {
                this.reset();
                console.log('complete');
            },
        });
    }
    leave(name, isPromotion) {
        return new Promise((resolve, reject) => {
            const promoMsg = 'You might be charged by the Promoter because of being leave late!';
            const action = this.navService.groupType === 'b' ? 'cancel' : 'leave';
            const dialogRef = this.dialog.open(_ms_dialog__WEBPACK_IMPORTED_MODULE_6__["MsDialog"], {
                data: {
                    msg: 'Would you like to ' + action + ' ' + name + ' event!' + promoMsg,
                    btn: 'Yes',
                },
            });
            dialogRef.afterClosed().subscribe((result) => {
                resolve(result);
            });
        });
    }
    ngAfterViewInit() {
        this.overlayRef.msEnlarge.subscribe({
            next: (evt) => {
                if (evt.enlarged) {
                    this.overlayRef.onEnter(evt.alias, this.items[evt.alias].info);
                    this.overlayRef.show(true, true);
                    this.oldOverlayRef.show(true, true);
                    this.isOverlay = true;
                }
                else {
                    this.overlayRef.show(false, false);
                    this.oldOverlayRef.show(false, false);
                    this.isOverlay = false;
                }
            },
        });
    }
    onDelete(alias) {
        if (this.overlayData && this.overlayData.removable === false) {
            return;
        }
        if (alias && this.selectedItems[alias]) {
            this.selectedItems[alias].component.instance.focus(false);
            delete this.selectedItems[alias];
        }
        this.msDelete.emit(alias);
    }
    onRate(evt) {
        for (const selectedItem in this.selectedItems) {
            if (this.selectedItems.hasOwnProperty(selectedItem)) {
                if (this.selectedItems[selectedItem].component.instance.rated) {
                    if (this.selectedItems[selectedItem].info['createdBy'] !== undefined) {
                        this.httpService.index({
                            from: this.navService.selected !== undefined
                                ? this.navService.selected['info'].id
                                : undefined,
                            to: this.selectedItems[selectedItem].info['createdBy'],
                            ref: selectedItem,
                            rate: evt,
                        });
                    }
                    else {
                        this.httpService.index({
                            from: this.navService.selected !== undefined
                                ? this.navService.selected['info'].id
                                : undefined,
                            to: selectedItem,
                            ref: this.selectedItems[selectedItem].info['ref'],
                            rate: evt,
                        });
                    }
                    this.selectedItems[selectedItem].component.instance.update(evt + 1);
                }
            }
        }
        if (this.isOverlay) {
            this.overlayRef.update(evt + 1);
            // overlay update delay
            setTimeout(() => {
                const scrollView = this.itemsRef.element.nativeElement.parentElement;
                const inbox = scrollView.parentElement;
                const item = this.items[this.overlayRef.alias];
                let idx = this.itemsRef.indexOf(item.component.hostView);
                // skip dividers
                let alias;
                let viewRef;
                let panel;
                while (this.itemsRef.length > idx + 1 && !alias) {
                    viewRef = this.itemsRef.get(idx + 1);
                    panel = viewRef['rootNodes'][0];
                    alias = panel.children[0] ? panel.children[0].id : undefined;
                    if (!alias) {
                        idx++;
                    }
                }
                if (this.itemsRef.length > idx + 1) {
                    const oldAlias = this.overlayRef.alias;
                    this.oldOverlayRef.onEnter(oldAlias, this.items[oldAlias].info);
                    this.oldOverlayRef.elementView.nativeElement.parentElement.classList.add('animPanel');
                    this.overlayRef.onEnter(alias, this.items[alias].info);
                    this.items[alias].component.instance.rate();
                    if (this.items[alias].component.instance.visible === false) {
                        this.offsetTop +=
                            inbox.clientHeight / 2 + panel.getBoundingClientRect().height;
                        inbox.scrollTo({ top: this.offsetTop });
                    }
                }
                else {
                    this.direction = 1;
                    inbox.scrollTo({ top: inbox.scrollHeight });
                }
            }, 200);
            setTimeout(() => {
                this.oldOverlayRef.elementView.nativeElement.parentElement.classList.remove('animPanel');
            }, 1000);
        }
        this.rate = evt;
    }
    updatePage(inbox, isOffset = true) {
        if (!this.isSelected &&
            inbox.scrollTop === 0 &&
            this.direction === -1 &&
            !this.isRefreshing &&
            this.isPull) {
            this.isLoading = true;
            this.progress.mode = 'indeterminate';
            this.isRefreshing = true;
            this.createPage(this.direction).subscribe({
                complete: () => {
                    if (isOffset && this.offsetTop > 0) {
                        this.touched = false;
                        inbox.scrollTo({ top: this.offsetTop });
                    }
                    this.offsetTop = 0;
                    this.isLoading = false;
                    this.progress.mode = 'determine';
                    this.progress.value =
                        (inbox.scrollTop / (inbox.scrollHeight - inbox.clientHeight)) * 100;
                    this.isRefreshing = false;
                    this.isRefreshed = isOffset && true;
                },
            });
        }
        else {
            if (this.touched) {
                this.isRefreshed = false;
            }
        }
        if (Math.floor(inbox.scrollTop + inbox.offsetHeight + 20) >=
            inbox.scrollHeight &&
            this.direction === 1 &&
            !this.isRefreshing) {
            this.isLoading = true;
            this.progress.mode = 'query';
            this.isRefreshing = true;
            this.createPage(this.direction).subscribe({
                complete: () => {
                    this.isLoading = false;
                    this.progress.mode = 'determine';
                    this.progress.value =
                        (inbox.scrollTop / (inbox.scrollHeight - inbox.clientHeight)) * 100;
                    this.isRefreshing = false;
                    this.isRefreshed = isOffset && true;
                    this.onRate(this.rate);
                },
            });
        }
        else {
            if (this.touched) {
                this.isRefreshed = false;
            }
        }
        this.progress.value =
            (inbox.scrollTop / (inbox.scrollHeight - inbox.clientHeight)) * 100;
    }
    openDialog(idx, alias, overrideUrl) {
        let data;
        switch (this.actions[idx].type) {
            case 'list':
                data = JSON.parse(JSON.stringify(this.actions[idx].data));
                data.url = overrideUrl;
                break;
            case 'add':
                data = {
                    url: this.actions[idx].url !== undefined
                        ? this.actions[idx].url
                        : this.url,
                    multiple: this.actions[idx].multiple,
                    extra: this.extra,
                    isAdd: true,
                };
                break;
            case 'share':
                const params = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpParams"]();
                data = JSON.parse(JSON.stringify(this.items[alias].info));
                const shareUrl = data.url.substring(1);
                data.url = shareUrl.substring(shareUrl.indexOf('/'));
                this.httpService.get(data.url + '/share', params).subscribe({
                    next: (result) => {
                        if (navigator.share) {
                            navigator
                                .share({
                                title: result['info'].title,
                                text: result['info'].msg,
                                url: location.origin + '?xlink=' + result['link'].key,
                            })
                                .then(() => {
                                console.log('Thanks for sharing!');
                            })
                                .catch(console.error);
                        }
                        else {
                            console.log({
                                title: result['info'].title,
                                text: result['info'].msg,
                                url: location.origin + '?xlink=' + result['link'].key,
                            });
                            alert('Not implemented for desktop!');
                        }
                    },
                    error: (error) => {
                        this.progress.mode = 'determine';
                        this.progress.color = 'warn';
                    },
                    complete: () => {
                        console.log('complete');
                    },
                });
                return;
            case 'popup':
                data = {
                    url: this.actions[idx].url !== undefined
                        ? this.actions[idx].url
                        : this.url,
                    multiple: this.actions[idx].multiple,
                    selected: this.selectedItems,
                };
                break;
            case 'edit':
                if (this.items[alias] === undefined) {
                    return;
                }
                data = JSON.parse(JSON.stringify(this.items[alias].info));
                const url = data.url.substring(1);
                data.url = url.substring(url.indexOf('/'));
                break;
            case 'route':
                this.navService.selected = this.actions[idx].selected;
                this.navService.prevUrl = this.itemUrl;
                this.router.navigate([this.actions[idx].url]);
                return;
            case 'code':
                if (this.items[alias] === undefined) {
                    return;
                }
                data = JSON.parse(JSON.stringify(this.items[alias].info));
                break;
            default:
                data = this.selectedItems;
        }
        const dialogRef = this.dialog.open(this.actions[idx].component, {
            maxWidth: '100vw',
            maxHeight: '100vh',
            height: '100%',
            width: '100%',
            data,
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result !== undefined) {
                switch (this.actions[idx].type) {
                    case 'filter':
                        break;
                    case 'list':
                        this.reset();
                        break;
                    case 'add':
                        this.reset();
                        break;
                    case 'edit':
                        // update is complex, as you might need to create a new groupKey
                        this.reset();
                        break;
                    case 'attach':
                        break;
                }
            }
        });
    }
    setting() {
        const dialogRef = this.dialog.open(src_app_dating_components_forms_group_filter_group_filter_component__WEBPACK_IMPORTED_MODULE_5__["GroupFilterComponent"], {
            maxWidth: '100vw',
            maxHeight: '100vh',
            height: '100%',
            width: '100%',
        });
        dialogRef.afterClosed().subscribe((result) => {
            if (result !== undefined) {
                let item = result.filter((item) => {
                    return item.name === 'group';
                })[0];
                this.step = item.options[item.data[0]].value;
                this.range = { from: new Date(), to: new Date() };
                this.reset();
            }
        });
    }
    ngOnDestroy() {
        this.dialogSub.unsubscribe();
        this.status.unsubscribe();
        this.delete.unsubscribe();
        this.edit.unsubscribe();
        this.share.unsubscribe();
        this.clone.unsubscribe();
        this.code.unsubscribe();
        this.join.unsubscribe();
        this.recommend.unsubscribe();
        this.sub.unsubscribe();
    }
    numSequence(n) {
        return Array(n);
    }
    ngOnInit() {
        if (this.url === undefined) {
            let url = this.activatedRoute['_routerState'].snapshot.url;
            url = url.replace('/base', '');
            this.itemUrl = url;
            url = url.substring(1);
            url = url.substring(url.indexOf('/'));
            this.url = url;
        }
        else {
            let url = this.activatedRoute['_routerState'].snapshot.url;
            url = url.replace('/base', '');
            url = url.substring(1);
            url = url.substring(0, url.indexOf('/'));
            this.itemUrl = '/' + url + this.url;
        }
        this.sub = this.activatedRoute.data.subscribe((v) => {
            if (this.actions === undefined) {
                this.actions = v.actions ? v.actions : new Array();
            }
            //this.multiple = v.multiple;
            this.double = v.double;
            this.isEvent = v.event;
            this.group = v.group;
        });
        // subscribe for DATA channel
        let inbox = this.itemsRef.element.nativeElement.parentElement.parentElement;
        inbox.addEventListener('scroll', (e) => {
            const target = e === undefined ? {} : e.srcElement || e.target;
            this.scrollTop = target.scrollTop;
            this.updatePage(target);
            // hide modal - like rate bar
            if (this.touched) {
                if (!this.isOverlay) {
                    for (const selectedItem in this.selectedItems) {
                        if (this.selectedItems.hasOwnProperty(selectedItem)) {
                            if (this.selectedItems[selectedItem].component.instance.rated) {
                                this.selectedItems[selectedItem].component.instance.focus(false);
                                delete this.selectedItems[selectedItem];
                            }
                        }
                    }
                    if (this.rate && this.double) {
                        this.actions.pop();
                    }
                    this.rate = undefined;
                }
            }
        }, { passive: true });
        inbox.addEventListener('touchstart', (e) => {
            this.isSelected = false;
            this._startY = e.touches[0].pageY;
        }, { passive: true });
        inbox.addEventListener('touchend', (e) => {
            this.touched = true;
            // this.isRefreshing = false;
        }, { passive: true });
        inbox.addEventListener('touchmove', (e) => {
            const y = e.touches[0].pageY;
            this.direction = y > this._startY ? -1 : 1;
            this.updatePage(inbox);
        }, { passive: true });
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                const id = entry.target.children[0].id;
                if (this.items[id]) {
                    const component = this.items[id].component;
                    component.instance.show(entry.isIntersecting);
                }
            });
        });
        this.itemFactory = this.resolver.resolveComponentFactory(_ms_panel__WEBPACK_IMPORTED_MODULE_8__["MsPanel"]);
        this.direction = 1;
        const url = Object(_app_app_routing_strategy__WEBPACK_IMPORTED_MODULE_7__["getUrl"])(this.activatedRoute.snapshot);
        this.isAdmin = url.indexOf('admin') !== -1;
        if (!this.isAdmin) {
            this.progress.mode = 'indeterminate';
            this.httpService
                .sync()
                .then(() => {
                this.updatePage(inbox, false);
            })
                .catch((e) => {
                this.progress.mode = 'determine';
                this.progress.color = 'warn';
            });
        }
        else {
            this.updatePage(inbox, false);
        }
    }
    createPage(direction) {
        return new rxjs__WEBPACK_IMPORTED_MODULE_4__["Observable"]((observer) => {
            let params = new _angular_common_http__WEBPACK_IMPORTED_MODULE_1__["HttpParams"]();
            if (this.offset !== undefined) {
                if (this.step === 'm') {
                    let d;
                    if (direction === -1) {
                        d = this.range.from;
                    }
                    else if (direction === 1) {
                        d = this.range.to;
                    }
                    let month = d.getMonth();
                    let year = d.getFullYear();
                    if (direction === -1) {
                        month = d.getMonth() - 1;
                        if (month < 0) {
                            year = d.getFullYear() - 1;
                            month = 11;
                        }
                        this.range.from = new Date(year, month, 1);
                    }
                    else if (direction === 1) {
                        month = d.getMonth() + 1;
                        if (month > 12) {
                            year = d.getFullYear() + 1;
                            month = 1;
                        }
                        this.range.to = new Date(year, month, 1);
                    }
                    this.offset[0] = new Date(year, month + 1, 1).toISOString();
                }
                for (const offsetItem of this.offset) {
                    params = params.append('offset', encodeURIComponent(offsetItem));
                }
            }
            if (this.step !== undefined) {
                params = params.set('step', this.step);
            }
            if (direction !== undefined) {
                params = params.set('direction', direction.toString());
            }
            this.httpService.get(this.url, params).subscribe({
                next: (data) => {
                    if (data['role'] !== undefined && data['role'] !== 'M') {
                        this.actions = this.actions.filter((action) => action.type !== 'add');
                    }
                    if (data['step'] !== undefined) {
                        this.step = data['step'];
                    }
                    if (data['offset']) {
                        this.offset = data['offset'];
                        this.isPull = data['scroll'] !== 1;
                    }
                    if (data['values']) {
                        if (this.step !== 'm') {
                            if (direction === -1) {
                                data['values'] = data['values'].reverse();
                            }
                            data['values'].forEach((obj, idx) => {
                                this.addToList(direction, obj);
                            });
                        }
                        else {
                            const date = new Date(this.offset[0]);
                            const groupKey = date.getFullYear() + ' ' + months[date.getMonth()];
                            this.addToTable(direction, groupKey, data['values']);
                        }
                        setTimeout(() => {
                            const scrollView = this.itemsRef.element.nativeElement.parentElement;
                            const height = scrollView.getBoundingClientRect().height;
                            if (direction) {
                                this.offsetTop = height - this.height;
                            }
                            this.height = height;
                            this.progress.mode = 'determine';
                            observer.complete();
                        });
                    }
                },
                error: (error) => {
                    if (error && error.key !== undefined) {
                        if (this.navService.locale !== undefined) {
                            const msg = this.navService.locale[error.value];
                            this._snackBar.open(msg, undefined, { duration: 1500 });
                        }
                    }
                    this.progress.mode = 'determine';
                    this.progress.color = 'warn';
                },
                complete: () => {
                    console.log('complete');
                },
            });
        });
    }
    addToTable(direction, groupKey, data) {
        let items = new Array();
        // tslint:disable-next-line: prefer-for-of
        for (let i = 0; i < data.length; i++) {
            const item = this.transformService.transform(data[i], this.url, true, false, true);
            // filter duplicate
            if (item === undefined || this.items[item.id] !== undefined) {
                continue;
            }
            items.push(item);
        }
        const groupView = this.dividerRef.createEmbeddedView({
            title: groupKey,
        });
        const calView = this.calendarRef.createEmbeddedView({
            data: { id: new Date(groupKey), items },
        });
        if (direction === -1 || direction === 0) {
            this.itemsRef.insert(calView, 0);
            this.itemsRef.insert(groupView, 0);
        }
        else if (direction === 1) {
            this.itemsRef.insert(groupView);
            this.itemsRef.insert(calView);
        }
    }
    addToList(direction, data) {
        const item = this.transformService.transform(data, this.itemUrl, true);
        if (this.items.length === 0) {
            this.extra = item.extra;
        }
        // filter duplicate
        if (item === undefined || this.items[item.id] !== undefined) {
            return;
        }
        const component = this.itemFactory.create(injector);
        component.instance.selectable = this.selectable;
        this.createItemFunction(component);
        let viewRef;
        let groupViewRef;
        if (item.groupKey !== undefined) {
            groupViewRef = this.createGroupCmp(item.groupKey, direction);
        }
        if (direction === -1 || direction === 0) {
            let viewIdx = 0;
            if (groupViewRef !== undefined) {
                viewIdx = this.itemsRef.indexOf(groupViewRef) + 1;
            }
            viewRef = this.itemsRef.insert(component.hostView, viewIdx);
        }
        else if (direction === 1) {
            viewRef = this.itemsRef.insert(component.hostView);
        }
        component.instance.onEnter(item.id, item);
        this.items[item.id] = { component, info: item };
        this.observer.observe(viewRef.rootNodes[0]);
    }
    // it can insert anywhere, not only top bottom - as when you add an event,
    // you don't know whether you are at the end of the list, but you need to scroll down or up to the newly added element
    createGroupCmp(key, direction) {
        let viewRef;
        const groupView = this.dividerRef.createEmbeddedView({
            title: key,
        });
        if (this.itemsRef.length === 0 ||
            (direction === -1 && this.rangeDist.from > key)) {
            this.rangeDist.from = key;
            if (this.itemsRef.length === 0) {
                this.rangeDist.to = key;
            }
            viewRef = this.itemsRef.insert(groupView, 0);
        }
        else if (direction === 1 && this.rangeDist.to < key) {
            this.rangeDist.to = key;
            viewRef = this.itemsRef.insert(groupView);
        }
        return viewRef;
    }
    createItemFunction(component) {
        component.instance.msSelect.subscribe({
            next: (evt) => {
                const alreadySelected = this.selectedItems[evt.alias];
                let hasRated = false;
                for (const selectedItem in this.selectedItems) {
                    if (this.selectedItems.hasOwnProperty(selectedItem)) {
                        if (selectedItem !== evt.alias && !this.multiple) {
                            this.selectedItems[selectedItem].component.instance.focus(false);
                            delete this.selectedItems[selectedItem];
                        }
                        if (this.multiple &&
                            !hasRated &&
                            this.selectedItems[selectedItem].component.instance.rated) {
                            hasRated = true;
                        }
                    }
                }
                if (!alreadySelected ||
                    !alreadySelected.component.instance.selected ||
                    alreadySelected.component.instance.rated) {
                    this.selectedItems[evt.alias] = this.items[evt.alias];
                    this.selectedItems[evt.alias].component.instance.focus(true, false, true);
                }
                else {
                    alreadySelected.component.instance.focus(false);
                    delete this.selectedItems[evt.alias];
                }
                if (!hasRated) {
                    this.rate = undefined;
                    if (this.double) {
                        this.actions.pop();
                    }
                }
                this.msSelect.emit(this.selectedItems);
            },
        });
        component.instance.msRate.subscribe({
            next: (evt) => {
                const alreadySelected = this.selectedItems[evt.alias];
                for (const selectedItem in this.selectedItems) {
                    if (this.selectedItems.hasOwnProperty(selectedItem)) {
                        if (selectedItem !== evt.alias && !this.multiple) {
                            this.selectedItems[selectedItem].component.instance.focus(false);
                            delete this.selectedItems[selectedItem];
                            if (this.double) {
                                this.actions.pop();
                            }
                        }
                    }
                }
                if (!alreadySelected ||
                    !alreadySelected.component.instance.rated ||
                    alreadySelected.component.instance.selected ||
                    evt.always) {
                    this.selectedItems[evt.alias] = this.items[evt.alias];
                    this.selectedItems[evt.alias].component.instance.focus(true, true, false);
                    this.rate = evt.rate - 1;
                    if (!evt.always && this.double) {
                        let pairObj = JSON.parse(JSON.stringify(pairRate));
                        const url = this.items[evt.alias].info.url.substring(1);
                        const baseUrl = '/' + url.substring(0, url.indexOf('/'));
                        pairObj['url'] = baseUrl + '/' + pairObj['url'] + '/' + evt.alias;
                        pairObj['selected'] = this.selectedItems[evt.alias];
                        this.actions.push(pairObj);
                    }
                }
                else {
                    alreadySelected.component.instance.focus(false);
                    delete this.selectedItems[evt.alias];
                    this.rate = undefined;
                    if (this.double) {
                        this.actions.pop();
                    }
                }
            },
        });
        component.instance.msEnlarge.subscribe({
            next: (evt) => {
                if (evt.enlarged) {
                    this.overlayRef.onEnter(evt.alias, this.items[evt.alias].info);
                    this.overlayRef.show(true, true);
                    this.oldOverlayRef.show(true, true);
                    this.overlayRef.focus(false, evt.rated, false);
                    this.isOverlay = true;
                }
                else {
                    this.overlayRef.show(false, false);
                    this.oldOverlayRef.show(false, false);
                    this.isOverlay = false;
                }
            },
        });
    }
}
MsList.ɵfac = function MsList_Factory(t) { return new (t || MsList)(_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_2__["ComponentFactoryResolver"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_2__["Renderer2"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_angular_router__WEBPACK_IMPORTED_MODULE_3__["Router"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_angular_router__WEBPACK_IMPORTED_MODULE_3__["ActivatedRoute"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_angular_material_dialog__WEBPACK_IMPORTED_MODULE_9__["MatDialog"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](src_app_navigation_service__WEBPACK_IMPORTED_MODULE_10__["NavigationService"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](src_app_services_http_service__WEBPACK_IMPORTED_MODULE_11__["HttpService"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](src_app_services_transform_service__WEBPACK_IMPORTED_MODULE_12__["TransformService"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_angular_common__WEBPACK_IMPORTED_MODULE_0__["DatePipe"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_2__["ChangeDetectorRef"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](src_app_services_list_service__WEBPACK_IMPORTED_MODULE_13__["ListService"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_angular_material_snack_bar__WEBPACK_IMPORTED_MODULE_14__["MatSnackBar"])); };
MsList.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdefineComponent"]({ type: MsList, selectors: [["ms-list"]], viewQuery: function MsList_Query(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵviewQuery"](_c0, 3, _angular_core__WEBPACK_IMPORTED_MODULE_2__["ViewContainerRef"]);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵviewQuery"](_c1, 3, _angular_core__WEBPACK_IMPORTED_MODULE_2__["TemplateRef"]);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵviewQuery"](_c2, 3, _angular_core__WEBPACK_IMPORTED_MODULE_2__["TemplateRef"]);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵviewQuery"](_c3, 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵviewQuery"](_c4, 3);
    } if (rf & 2) {
        let _t;
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵloadQuery"]()) && (ctx.itemsRef = _t.first);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵloadQuery"]()) && (ctx.dividerRef = _t.first);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵloadQuery"]()) && (ctx.calendarRef = _t.first);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵloadQuery"]()) && (ctx.overlayRef = _t.first);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵloadQuery"]()) && (ctx.oldOverlayRef = _t.first);
    } }, inputs: { overlayData: "overlayData", selectable: "selectable", actions: "actions", multiple: "multiple", double: "double", url: "url" }, outputs: { msSelect: "msSelect", msDelete: "msDelete" }, decls: 19, vars: 12, consts: [[3, "mode", "value", "color"], [1, "int_scroll", 3, "ngClass"], ["mat-group", "", 3, "click", 4, "ngIf"], [1, "panel_t"], ["class", "overlay", 4, "ngIf"], ["items", ""], [1, "mat-fab-container"], [4, "ngFor", "ngForOf"], [1, "list_overlay"], [1, "oldPanel"], ["oldOverlay", ""], ["overlay", ""], ["class", "mat-rate-bar", 4, "ngIf"], ["divider", ""], ["calendar", ""], ["mat-group", "", 3, "click"], [1, "overlay"], ["visible", "true", 3, "alias", "data", "removable", "msRemove"], ["mat-mini-fab", "", 3, "color", "click", 4, "ngIf"], ["mat-mini-fab", "", 3, "color", "click"], [1, "mat-rate-bar"], ["mat-button", "", "matRipple", "", 3, "ngClass", "click"], ["mat-rate", "", 3, "fontSet"], [1, "mat-divider"], [2, "grid-column", "1 / span 2", 3, "data"]], template: function MsList_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](0, "mat-progress-bar", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](1, "div", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](2, MsList_mat_icon_2_Template, 2, 0, "mat-icon", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](3, "div", 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](4, MsList_div_4_Template, 2, 3, "div", 4);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementContainer"](5, null, 5);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](7, "div", 6);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](8, MsList_ng_container_8_Template, 2, 1, "ng-container", 7);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](9, "div", 8);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](10, "ms-panel", 9, 10);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](12, "ms-panel", null, 11);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](14, MsList_div_14_Template, 2, 1, "div", 12);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](15, MsList_ng_template_15_Template, 2, 1, "ng-template", null, 13, _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplateRefExtractor"]);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](17, MsList_ng_template_17_Template, 1, 1, "ng-template", null, 14, _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplateRefExtractor"]);
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("mode", ctx.progress.mode)("value", ctx.progress.value)("color", ctx.progress.color);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵpureFunction1"](10, _c6, !ctx.isLoading && !ctx.isRefreshed && ctx.isSelected));
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.group);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.overlayData);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](4);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngForOf", ctx.actions);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵstyleProp"]("visibility", ctx.isOverlay ? "visible" : "hidden");
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](5);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.rate !== undefined);
    } }, directives: [_angular_material_progress_bar__WEBPACK_IMPORTED_MODULE_15__["MatProgressBar"], _angular_common__WEBPACK_IMPORTED_MODULE_0__["NgClass"], _angular_common__WEBPACK_IMPORTED_MODULE_0__["NgIf"], _angular_common__WEBPACK_IMPORTED_MODULE_0__["NgForOf"], _ms_panel__WEBPACK_IMPORTED_MODULE_8__["MsPanel"], _angular_material_icon__WEBPACK_IMPORTED_MODULE_16__["MatIcon"], _angular_material_button__WEBPACK_IMPORTED_MODULE_17__["MatButton"], _angular_material_core__WEBPACK_IMPORTED_MODULE_18__["MatRipple"], _ms_calendar_index__WEBPACK_IMPORTED_MODULE_19__["MsCalendar"]], encapsulation: 2 });


/***/ }),

/***/ "Sy1n":
/*!**********************************!*\
  !*** ./src/app/app.component.ts ***!
  \**********************************/
/*! exports provided: AppComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AppComponent", function() { return AppComponent; });
/* harmony import */ var tslib__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! tslib */ "mrSG");
/* harmony import */ var _angular_router__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/router */ "tyNb");
/* harmony import */ var firebase_app__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! firebase/app */ "Jgta");
/* harmony import */ var firebase_messaging__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! firebase/messaging */ "dB9c");
/* harmony import */ var src_environments_environment__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! src/environments/environment */ "AytR");
/* harmony import */ var _animation__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./animation */ "38kq");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _navigation_service__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./navigation.service */ "2NUr");
/* harmony import */ var _angular_service_worker__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @angular/service-worker */ "Jho9");
/* harmony import */ var _services_http_service__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./services/http.service */ "N+K7");
/* harmony import */ var ngx_facebook__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ngx-facebook */ "vEIf");
/* harmony import */ var _services_list_service__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./services/list.service */ "YoPC");
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _angular_material_tabs__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! @angular/material/tabs */ "wZkO");
/* harmony import */ var _angular_material_icon__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @angular/material/icon */ "NFeN");
/* harmony import */ var _angular_material_badge__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @angular/material/badge */ "TU8p");
/* harmony import */ var _angular_material_button__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @angular/material/button */ "bTqV");
/* harmony import */ var _angular_material_chips__WEBPACK_IMPORTED_MODULE_18__ = __webpack_require__(/*! @angular/material/chips */ "A5z7");




















function AppComponent_nav_0_a_1_mat_icon_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "mat-icon", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const link_r5 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"]().$implicit;
    const _r6 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵreference"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("fontSet", _r6.isActive ? "material-icons" : "material-icons-outlined")("color", _r6.isActive ? "warn" : "primary");
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtextInterpolate1"](" ", link_r5.data.icon, " ");
} }
function AppComponent_nav_0_a_1_mat_icon_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "mat-icon", 12);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const link_r5 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"]().$implicit;
    const _r6 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵreference"](1);
    const ctx_r8 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("matBadge", ctx_r8.navService.groupName)("fontSet", _r6.isActive ? "material-icons" : "material-icons-outlined")("color", _r6.isActive ? "warn" : "primary");
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtextInterpolate1"](" ", link_r5.data.icon, " ");
} }
function AppComponent_nav_0_a_1_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "a", 7, 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](2, AppComponent_nav_0_a_1_mat_icon_2_Template, 2, 3, "mat-icon", 9);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](3, AppComponent_nav_0_a_1_mat_icon_3_Template, 2, 4, "mat-icon", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const link_r5 = ctx.$implicit;
    const _r6 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵreference"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("routerLink", link_r5.path)("active", _r6.isActive);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngIf", link_r5.data.icon !== "person");
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngIf", link_r5.data.icon === "person");
} }
function AppComponent_nav_0_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "nav", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](1, AppComponent_nav_0_a_1_Template, 4, 4, "a", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r0 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngForOf", ctx_r0.links);
} }
function AppComponent_nav_1_mat_chip_6_p_1_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "p", 19);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const item_r13 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"]().$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtextInterpolate"](item_r13.info.header ? item_r13.info.name : "");
} }
function AppComponent_nav_1_mat_chip_6_p_2_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "p");
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const item_r13 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"]().$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtextInterpolate"](item_r13.info.header ? item_r13.info.name : "");
} }
function AppComponent_nav_1_mat_chip_6_mat_chip_avatar_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "mat-chip-avatar");
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelement"](1, "img", 20);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const item_r13 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"]().$implicit;
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("src", item_r13.info.imgs[0], _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵsanitizeUrl"]);
} }
const _c0 = function (a0) { return { "ms-active": a0 }; };
function AppComponent_nav_1_mat_chip_6_Template(rf, ctx) { if (rf & 1) {
    const _r22 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "mat-chip", 16);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵlistener"]("click", function AppComponent_nav_1_mat_chip_6_Template_mat_chip_click_0_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵrestoreView"](_r22); const idx_r14 = ctx.index; const ctx_r21 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"](2); return ctx_r21.onBasket(idx_r14); });
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](1, AppComponent_nav_1_mat_chip_6_p_1_Template, 2, 1, "p", 17);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](2, AppComponent_nav_1_mat_chip_6_p_2_Template, 2, 1, "p", 18);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](3, AppComponent_nav_1_mat_chip_6_mat_chip_avatar_3_Template, 2, 1, "mat-chip-avatar", 18);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const item_r13 = ctx.$implicit;
    const idx_r14 = ctx.index;
    const ctx_r11 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngClass", _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵpureFunction1"](4, _c0, idx_r14 === ctx_r11.selectedIdx));
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngIf", item_r13.info.imgs && item_r13.info.imgs[0]);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngIf", !item_r13.info.imgs || !item_r13.info.imgs[0]);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngIf", item_r13.info.imgs && item_r13.info.imgs[0]);
} }
function AppComponent_nav_1_a_7_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "a", 7, 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](2, "mat-icon", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const link_r23 = ctx.$implicit;
    const _r24 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵreference"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("routerLink", link_r23.path)("active", _r24.isActive);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("fontSet", _r24.isActive ? "material-icons" : "material-icons-outlined")("color", _r24.isActive ? "warn" : "primary");
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtextInterpolate1"](" ", link_r23.data.icon, " ");
} }
function AppComponent_nav_1_Template(rf, ctx) { if (rf & 1) {
    const _r26 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "nav", 5);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](1, "button", 13);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵlistener"]("click", function AppComponent_nav_1_Template_button_click_1_listener() { _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵrestoreView"](_r26); const ctx_r25 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"](); return ctx_r25.back(); });
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](2, "mat-icon");
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtext"](3, "arrow_backward");
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](4, "div", 14);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](5, "mat-chip-list");
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](6, AppComponent_nav_1_mat_chip_6_Template, 4, 6, "mat-chip", 15);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](7, AppComponent_nav_1_a_7_Template, 4, 5, "a", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r1 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](6);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngForOf", ctx_r1.items);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngForOf", ctx_r1.itemLinks);
} }
function AppComponent_nav_5_a_1_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "a", 7, 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](2, "mat-icon", 11);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtext"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const link_r28 = ctx.$implicit;
    const _r29 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵreference"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("routerLink", link_r28.path)("active", _r29.isActive);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("fontSet", _r29.isActive ? "material-icons" : "material-icons-outlined")("color", _r29.isActive ? "warn" : "primary");
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtextInterpolate1"](" ", link_r28.data.icon, " ");
} }
function AppComponent_nav_5_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](0, "nav", 21);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](1, AppComponent_nav_5_a_1_Template, 4, 5, "a", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r3 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngForOf", ctx_r3.subLinks);
} }
const _c1 = function (a1) { return { position: "relative", height: a1 }; };
// pdf js file upload
// https://codepen.io/Shiyou/pen/JNLwVO?html-preprocessor=pug
class AppComponent {
    constructor(router, zone, navService, updates, push, httpService, facebookService, activatedRoute, listService, domSanitizer) {
        // this.initFacebookService();
        this.router = router;
        this.zone = zone;
        this.navService = navService;
        this.updates = updates;
        this.push = push;
        this.httpService = httpService;
        this.facebookService = facebookService;
        this.activatedRoute = activatedRoute;
        this.listService = listService;
        this.domSanitizer = domSanitizer;
        this.items = new Array();
        this.itemKeys = new Array();
        this.activatedRoute.queryParams.subscribe((params) => {
            if (params['xlink'] !== undefined) {
                const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                if (regex.test(params['xlink'])) {
                    this.navService.xlink = params['xlink'];
                }
            }
        });
        this.navService.reset.subscribe(() => {
            this.prevUrl = undefined;
            this.links = undefined;
            this.itemLinks = undefined;
            this.subLinks = undefined;
            this.basePath = undefined;
        });
        this.navService.online.next({ online: navigator.onLine });
    }
    /*
      openSnackBar(item: any, action: string) {
      let snack = this._snackBar.open(item.idx, action, {
        verticalPosition: 'top',
      });
  
      snack.afterDismissed().subscribe(() => {
        item.callback('auuuu');
      });
    }*/
    initFacebookService() {
        const initParams = { xfbml: true, version: 'v10.0' };
        this.facebookService.init(initParams);
    }
    ngAfterViewInit() { }
    online(evt) {
        this.navService.online.next({ online: evt.type === 'online' });
    }
    ngOnInit() {
        navigator.geolocation.getCurrentPosition((position) => {
            this.navService.pos = [
                position.coords.longitude,
                position.coords.latitude,
            ];
        });
        if (this.navService.locale === undefined) {
            this.httpService.get('/messages').subscribe({
                next: (value) => {
                    const evt = value['msg'];
                    if (evt['expl.videos']) {
                        evt['expl.videos'] = evt['expl.videos'].map((video) => this.domSanitizer.bypassSecurityTrustResourceUrl(video));
                    }
                    this.navService.locale = evt;
                },
                error: (error) => {
                    console.log('Server is down!');
                },
                complete: () => { },
            });
        }
        this.router.events.subscribe((routerEvent) => {
            if (routerEvent instanceof _angular_router__WEBPACK_IMPORTED_MODULE_1__["ChildActivationStart"]) {
                const routeConfig = routerEvent.snapshot.routeConfig;
                const url = routerEvent.snapshot['_routerState'].url;
                if (routeConfig) {
                    if (routeConfig.children) {
                        let baseUrl;
                        if (routeConfig.data.type === 'P') {
                            const rootPath = routeConfig.path.replace('/:id', '');
                            const urlParts = url.split(rootPath);
                            baseUrl = urlParts[0] + rootPath;
                        }
                        else {
                            let startIdx = 0;
                            if (url.indexOf('/') === 0) {
                                startIdx = 1;
                            }
                            baseUrl = url.substr(startIdx, url.lastIndexOf('/') - 1);
                        }
                        const links = routeConfig.children
                            .filter((route) => route.redirectTo === undefined && !route.data.dialog)
                            .map((route) => ({
                            path: baseUrl +
                                '/' +
                                (routeConfig.data.type === 'P'
                                    ? route.path.replace(':id', this.navService.profileId)
                                    : route.path),
                            data: route.data,
                        }));
                        if (routeConfig.path.indexOf(':id') !== -1) {
                            this.prevUrl =
                                this.navService.prevUrl !== undefined
                                    ? this.navService.prevUrl
                                    : baseUrl.substr(0, baseUrl.lastIndexOf('/'));
                            this.itemLinks = links;
                            this.subLinks = undefined;
                            if (this.navService.selected !== undefined) {
                                if (this.itemKeys[this.navService.selected['info'].id] ===
                                    undefined) {
                                    this.items.push(this.navService.selected);
                                    this.itemKeys[this.navService.selected['info'].id] = true;
                                }
                            }
                        }
                        else {
                            if (links.length === 1 && links[0].data.icon === undefined) {
                                this.subLinks = undefined;
                            }
                            else {
                                this.subLinks = links;
                            }
                        }
                    }
                    else if (routeConfig.loadChildren) {
                        this.links = routeConfig['_loadedConfig'].routes
                            .filter((route) => route.redirectTo === undefined && !route.data.dialog)
                            .map((route) => ({
                            path: routeConfig.path +
                                '/' +
                                route.path +
                                (route.data.type === 'P'
                                    ? '/' + this.navService.profileId
                                    : ''),
                            data: route.data,
                        }));
                        this.subLinks = undefined;
                    }
                }
                else {
                    this.subLinks = undefined;
                }
            }
        });
        this.updates.available.subscribe((_) => this.updates.activateUpdate().then(() => {
            console.log('reload for update');
            document.location.reload();
        }));
        this.push.notificationClicks.subscribe((click) => console.log('notification click', click));
        if (firebase_app__WEBPACK_IMPORTED_MODULE_2__["default"].apps.length === 0) {
            firebase_app__WEBPACK_IMPORTED_MODULE_2__["default"].initializeApp(src_environments_environment__WEBPACK_IMPORTED_MODULE_4__["environment"].firebase);
            firebase_app__WEBPACK_IMPORTED_MODULE_2__["default"].auth().onIdTokenChanged((user) => {
                if (user) {
                    user
                        .getIdToken()
                        .then((token) => {
                        this.navService.token = token;
                    })
                        .catch((error) => { });
                    if (this.timer !== undefined) {
                        clearInterval(this.timer);
                    }
                    this.timer = setInterval(() => {
                        const currentUser = firebase_app__WEBPACK_IMPORTED_MODULE_2__["default"].auth().currentUser;
                        currentUser
                            .getIdToken()
                            .then((token) => {
                            this.navService.token = token;
                        })
                            .catch((error) => { });
                    }, 25 * 60 * 1000);
                }
            });
            firebase_app__WEBPACK_IMPORTED_MODULE_2__["default"].auth().onAuthStateChanged((user) => {
                if (user) {
                    console.log('user-logged');
                    user
                        .getIdToken()
                        .then((token) => {
                        this.navService.token = token;
                        this.httpService.get('/user').subscribe({
                            next: (value) => {
                                this.msg().then((x) => {
                                    console.log('Messaging initialized!');
                                });
                                /*const group = value['user'].group;
                                const groups = value['groups'];
              
                                let groupType;
                                for (const item of groups) {
                                  if (item.group.key === group) {
                                    groupType = environment.groupTypes[item.group.type];
                                    this.navService.groupName = item.group.name[0];
                                    this.navService.groupType = item.group.type;
                                    break;
                                  }
                                }
              
                                const notif = {};
                                for (const like of value['likes']) {
                                  notif[groupType + '/' + like.root] = like.value;
                                }
                                this.navService.notif = notif;
              
                                if (
                                  value['user'].profile === undefined ||
                                  value['user'].profile.status === 'I'
                                ) {
                                  this.router.navigate([groupType + '/user']);
                                } else {
                                  this.router.navigate([groupType]);
                                }*/
                                this.router.navigate(['dating']);
                            },
                            error: (err) => {
                                this.router.navigate(['dating/user']);
                            },
                        });
                        // this.zone.run(() => {
                        //  this.router.navigate(['dating']);
                        // });
                    })
                        .catch((error) => { });
                }
                else {
                    if (this.timer !== undefined) {
                        clearInterval(this.timer);
                    }
                    console.log('user-not-logged');
                    this.navService.token = undefined;
                    this.router.navigate(['login']);
                }
            });
        }
        // this.router.navigate(['test']);
    }
    msg() {
        return Object(tslib__WEBPACK_IMPORTED_MODULE_0__["__awaiter"])(this, void 0, void 0, function* () {
            const registration = yield navigator.serviceWorker.ready;
            firebase_app__WEBPACK_IMPORTED_MODULE_2__["default"].messaging().onMessage((msg) => {
                console.log(msg);
            });
            firebase_app__WEBPACK_IMPORTED_MODULE_2__["default"]
                .messaging()
                .getToken({
                vapidKey: src_environments_environment__WEBPACK_IMPORTED_MODULE_4__["environment"].vapid,
                serviceWorkerRegistration: registration,
            })
                .then((currentToken) => {
                if (currentToken) {
                    this.httpService
                        .post('/tokens', { deviceKey: currentToken })
                        .subscribe({
                        next: (value) => {
                            console.log(value);
                        },
                        error: (err) => {
                            console.log('Token registration error!');
                        },
                    });
                }
                else {
                    console.log('No registration token available. Request permission to generate one.');
                }
            })
                .catch((err) => {
                console.log('An error occurred while retrieving token. ', err);
            });
        });
    }
    ngOnDestroy() { }
    back() {
        this.items = new Array();
        this.itemKeys = new Array();
        this.navService.selected = undefined;
        this.itemLinks = undefined;
        const prevUrl = this.navService.prevUrl !== undefined
            ? this.navService.prevUrl
            : this.prevUrl;
        this.navService.prevUrl = undefined;
        this.router.navigate([prevUrl]);
    }
    prepareRoute(outlet) {
        return (outlet && outlet.activatedRouteData && outlet.activatedRouteData.animation);
    }
    onBasket(idx) {
        if (idx === this.selectedIdx) {
            this.selectedIdx = undefined;
            this.overlayData = undefined;
        }
        else {
            this.selectedIdx = idx;
            this.overlayData = this.items[idx].info;
        }
        if (this.overlayData) {
            this.overlayData.removable = false;
        }
        this.listService.overlay.emit(this.overlayData);
    }
}
AppComponent.ɵfac = function AppComponent_Factory(t) { return new (t || AppComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdirectiveInject"](_angular_router__WEBPACK_IMPORTED_MODULE_1__["Router"]), _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_6__["NgZone"]), _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdirectiveInject"](_navigation_service__WEBPACK_IMPORTED_MODULE_7__["NavigationService"]), _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdirectiveInject"](_angular_service_worker__WEBPACK_IMPORTED_MODULE_8__["SwUpdate"]), _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdirectiveInject"](_angular_service_worker__WEBPACK_IMPORTED_MODULE_8__["SwPush"]), _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdirectiveInject"](_services_http_service__WEBPACK_IMPORTED_MODULE_9__["HttpService"]), _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdirectiveInject"](ngx_facebook__WEBPACK_IMPORTED_MODULE_10__["FacebookService"]), _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdirectiveInject"](_angular_router__WEBPACK_IMPORTED_MODULE_1__["ActivatedRoute"]), _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdirectiveInject"](_services_list_service__WEBPACK_IMPORTED_MODULE_11__["ListService"]), _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdirectiveInject"](_angular_platform_browser__WEBPACK_IMPORTED_MODULE_12__["DomSanitizer"])); };
AppComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵdefineComponent"]({ type: AppComponent, selectors: [["app-root"]], hostBindings: function AppComponent_HostBindings(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵlistener"]("online", function AppComponent_online_HostBindingHandler($event) { return ctx.online($event); }, false, _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵresolveWindow"])("offline", function AppComponent_offline_HostBindingHandler($event) { return ctx.online($event); }, false, _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵresolveWindow"]);
    } }, decls: 7, vars: 7, consts: [["mat-tab-nav-bar", "", "mat-align-tabs", "center", 4, "ngIf"], [3, "ngStyle"], ["outlet", "outlet"], ["mat-tab-nav-bar", "", "mat-align-tabs", "center", "class", "mat-tab-footer", 4, "ngIf"], ["attribution", "setup_tool", "page_id", "106303131653978", 1, "fb-customerchat"], ["mat-tab-nav-bar", "", "mat-align-tabs", "center"], ["mat-tab-link", "", "routerLinkActive", "", 3, "routerLink", "active", 4, "ngFor", "ngForOf"], ["mat-tab-link", "", "routerLinkActive", "", 3, "routerLink", "active"], ["rla", "routerLinkActive"], [3, "fontSet", "color", 4, "ngIf"], [3, "matBadge", "fontSet", "color", 4, "ngIf"], [3, "fontSet", "color"], [3, "matBadge", "fontSet", "color"], ["mat-icon-button", "", 1, "mat-item", 3, "click"], [1, "mat-basket-container-small", 2, "top", "8px"], ["matRipple", "", 3, "ngClass", "click", 4, "ngFor", "ngForOf"], ["matRipple", "", 3, "ngClass", "click"], ["style", "width: 40px;", 4, "ngIf"], [4, "ngIf"], [2, "width", "40px"], [3, "src"], ["mat-tab-nav-bar", "", "mat-align-tabs", "center", 1, "mat-tab-footer"]], template: function AppComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](0, AppComponent_nav_0_Template, 2, 1, "nav", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](1, AppComponent_nav_1_Template, 8, 2, "nav", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementStart"](2, "div", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelement"](3, "router-outlet", null, 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵtemplate"](5, AppComponent_nav_5_Template, 2, 1, "nav", 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵelement"](6, "div", 4);
    } if (rf & 2) {
        const _r2 = _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵreference"](4);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngIf", ctx.links && !ctx.itemLinks);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngIf", ctx.links && ctx.itemLinks);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngStyle", _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵpureFunction1"](5, _c1, ctx.links ? "calc(100vh - " + (ctx.subLinks ? "98px" : "49px") + ")" : "100vh"))("@routeAnimations", ctx.prepareRoute(_r2));
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵadvance"](3);
        _angular_core__WEBPACK_IMPORTED_MODULE_6__["ɵɵproperty"]("ngIf", ctx.links && ctx.subLinks);
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_13__["NgIf"], _angular_common__WEBPACK_IMPORTED_MODULE_13__["NgStyle"], _angular_router__WEBPACK_IMPORTED_MODULE_1__["RouterOutlet"], _angular_material_tabs__WEBPACK_IMPORTED_MODULE_14__["MatTabNav"], _angular_common__WEBPACK_IMPORTED_MODULE_13__["NgForOf"], _angular_router__WEBPACK_IMPORTED_MODULE_1__["RouterLinkWithHref"], _angular_material_tabs__WEBPACK_IMPORTED_MODULE_14__["MatTabLink"], _angular_router__WEBPACK_IMPORTED_MODULE_1__["RouterLinkActive"], _angular_material_icon__WEBPACK_IMPORTED_MODULE_15__["MatIcon"], _angular_material_badge__WEBPACK_IMPORTED_MODULE_16__["MatBadge"], _angular_material_button__WEBPACK_IMPORTED_MODULE_17__["MatButton"], _angular_material_chips__WEBPACK_IMPORTED_MODULE_18__["MatChipList"], _angular_material_chips__WEBPACK_IMPORTED_MODULE_18__["MatChip"], _angular_common__WEBPACK_IMPORTED_MODULE_13__["NgClass"], _angular_material_chips__WEBPACK_IMPORTED_MODULE_18__["MatChipAvatar"]], encapsulation: 2, data: { animation: [
            _animation__WEBPACK_IMPORTED_MODULE_5__["slideInAnimation"],
        ] } });


/***/ }),

/***/ "YoPC":
/*!******************************************!*\
  !*** ./src/app/services/list.service.ts ***!
  \******************************************/
/*! exports provided: ListService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "ListService", function() { return ListService; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");


class ListService {
    constructor() {
        this._edit = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._remove = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._add = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._move = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._code = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._share = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._overlay = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._status = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._clone = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._join = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._dialog = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._refresh = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._recommend = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._delete = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
    }
    get edit() {
        return this._edit;
    }
    get share() {
        return this._share;
    }
    get clone() {
        return this._clone;
    }
    get join() {
        return this._join;
    }
    get status() {
        return this._status;
    }
    get remove() {
        return this._remove;
    }
    get move() {
        return this._move;
    }
    get add() {
        return this._add;
    }
    get code() {
        return this._code;
    }
    get overlay() {
        return this._overlay;
    }
    get dialog() {
        return this._dialog;
    }
    get refresh() {
        return this._refresh;
    }
    get recommend() {
        return this._recommend;
    }
    get delete() {
        return this._delete;
    }
}
ListService.ɵfac = function ListService_Factory(t) { return new (t || ListService)(); };
ListService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: ListService, factory: ListService.ɵfac, providedIn: 'root' });


/***/ }),

/***/ "ZAI4":
/*!*******************************!*\
  !*** ./src/app/app.module.ts ***!
  \*******************************/
/*! exports provided: AppModule */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AppModule", function() { return AppModule; });
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");
/* harmony import */ var _angular_platform_browser_animations__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/platform-browser/animations */ "R1ws");
/* harmony import */ var _angular_material_icon__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @angular/material/icon */ "NFeN");
/* harmony import */ var _angular_material_tabs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/material/tabs */ "wZkO");
/* harmony import */ var _angular_material_snack_bar__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! @angular/material/snack-bar */ "dNgK");
/* harmony import */ var _angular_material_button__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @angular/material/button */ "bTqV");
/* harmony import */ var _angular_material_card__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @angular/material/card */ "Wp6s");
/* harmony import */ var _app_component__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./app.component */ "Sy1n");
/* harmony import */ var _login_login_component__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./login/login.component */ "vtpD");
/* harmony import */ var _app_routing_module__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./app-routing.module */ "vY5A");
/* harmony import */ var _angular_service_worker__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @angular/service-worker */ "Jho9");
/* harmony import */ var _environments_environment__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ../environments/environment */ "AytR");
/* harmony import */ var _angular_common_http__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @angular/common/http */ "tk/3");
/* harmony import */ var ngx_facebook__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ngx-facebook */ "vEIf");
/* harmony import */ var _lib__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ../lib */ "psLn");
/* harmony import */ var _angular_material_badge__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! @angular/material/badge */ "TU8p");
/* harmony import */ var _angular_material_chips__WEBPACK_IMPORTED_MODULE_16__ = __webpack_require__(/*! @angular/material/chips */ "A5z7");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_17__ = __webpack_require__(/*! @angular/core */ "fXoL");




















class AppModule {
}
AppModule.ɵfac = function AppModule_Factory(t) { return new (t || AppModule)(); };
AppModule.ɵmod = _angular_core__WEBPACK_IMPORTED_MODULE_17__["ɵɵdefineNgModule"]({ type: AppModule, bootstrap: [_app_component__WEBPACK_IMPORTED_MODULE_7__["AppComponent"]] });
AppModule.ɵinj = _angular_core__WEBPACK_IMPORTED_MODULE_17__["ɵɵdefineInjector"]({ imports: [[
            _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
            _angular_platform_browser_animations__WEBPACK_IMPORTED_MODULE_1__["BrowserAnimationsModule"],
            _app_routing_module__WEBPACK_IMPORTED_MODULE_9__["AppRoutingModule"],
            _angular_material_icon__WEBPACK_IMPORTED_MODULE_2__["MatIconModule"],
            _angular_material_tabs__WEBPACK_IMPORTED_MODULE_3__["MatTabsModule"],
            _angular_material_snack_bar__WEBPACK_IMPORTED_MODULE_4__["MatSnackBarModule"],
            _angular_material_badge__WEBPACK_IMPORTED_MODULE_15__["MatBadgeModule"],
            _angular_material_button__WEBPACK_IMPORTED_MODULE_5__["MatButtonModule"],
            _angular_material_card__WEBPACK_IMPORTED_MODULE_6__["MatCardModule"],
            _angular_material_chips__WEBPACK_IMPORTED_MODULE_16__["MatChipsModule"],
            _angular_common_http__WEBPACK_IMPORTED_MODULE_12__["HttpClientModule"],
            _angular_service_worker__WEBPACK_IMPORTED_MODULE_10__["ServiceWorkerModule"].register('ngsw-worker.js', {
                enabled: _environments_environment__WEBPACK_IMPORTED_MODULE_11__["environment"].production,
                // Register the ServiceWorker as soon as the app is stable
                // or after 30 seconds (whichever comes first).
                registrationStrategy: 'registerWhenStable:30000',
            }),
            ngx_facebook__WEBPACK_IMPORTED_MODULE_13__["FacebookModule"].forRoot(),
        ]] });
(function () { (typeof ngJitMode === "undefined" || ngJitMode) && _angular_core__WEBPACK_IMPORTED_MODULE_17__["ɵɵsetNgModuleScope"](AppModule, { declarations: [_app_component__WEBPACK_IMPORTED_MODULE_7__["AppComponent"], _login_login_component__WEBPACK_IMPORTED_MODULE_8__["LoginComponent"], _lib__WEBPACK_IMPORTED_MODULE_14__["MsMenu"], _lib__WEBPACK_IMPORTED_MODULE_14__["MsFrame"], _lib__WEBPACK_IMPORTED_MODULE_14__["SvgLoad"]], imports: [_angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["BrowserModule"],
        _angular_platform_browser_animations__WEBPACK_IMPORTED_MODULE_1__["BrowserAnimationsModule"],
        _app_routing_module__WEBPACK_IMPORTED_MODULE_9__["AppRoutingModule"],
        _angular_material_icon__WEBPACK_IMPORTED_MODULE_2__["MatIconModule"],
        _angular_material_tabs__WEBPACK_IMPORTED_MODULE_3__["MatTabsModule"],
        _angular_material_snack_bar__WEBPACK_IMPORTED_MODULE_4__["MatSnackBarModule"],
        _angular_material_badge__WEBPACK_IMPORTED_MODULE_15__["MatBadgeModule"],
        _angular_material_button__WEBPACK_IMPORTED_MODULE_5__["MatButtonModule"],
        _angular_material_card__WEBPACK_IMPORTED_MODULE_6__["MatCardModule"],
        _angular_material_chips__WEBPACK_IMPORTED_MODULE_16__["MatChipsModule"],
        _angular_common_http__WEBPACK_IMPORTED_MODULE_12__["HttpClientModule"], _angular_service_worker__WEBPACK_IMPORTED_MODULE_10__["ServiceWorkerModule"], ngx_facebook__WEBPACK_IMPORTED_MODULE_13__["FacebookModule"]] }); })();


/***/ }),

/***/ "a6ou":
/*!************************************!*\
  !*** ./src/lib/ms-dialog/index.ts ***!
  \************************************/
/*! exports provided: MsDialog */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MsDialog", function() { return MsDialog; });
/* harmony import */ var _angular_material_dialog__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/material/dialog */ "0IaG");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _angular_material_button__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @angular/material/button */ "bTqV");




class MsDialog {
    constructor(dialogRef, data) {
        this.dialogRef = dialogRef;
        this.data = data;
    }
    onClick(val) {
        this.dialogRef.close(val);
    }
}
MsDialog.ɵfac = function MsDialog_Factory(t) { return new (t || MsDialog)(_angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdirectiveInject"](_angular_material_dialog__WEBPACK_IMPORTED_MODULE_0__["MatDialogRef"]), _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdirectiveInject"](_angular_material_dialog__WEBPACK_IMPORTED_MODULE_0__["MAT_DIALOG_DATA"])); };
MsDialog.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵdefineComponent"]({ type: MsDialog, selectors: [["ms-dialog"]], decls: 10, vars: 2, consts: [["mat-dialog-title", ""], ["mat-dialog-content", "", 1, "mat-confirm"], ["mat-dialog-actions", ""], ["mat-raised-button", "", "color", "primary", "cdkFocusInitial", "", 3, "click"], ["mat-raised-button", "", "color", "warn", 3, "click"]], template: function MsDialog_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](0, "h1", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](1, "Warning!");
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](2, "div", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](3, "p");
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](4);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](5, "div", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](6, "button", 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵlistener"]("click", function MsDialog_Template_button_click_6_listener() { return ctx.onClick(false); });
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](7, "No");
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementStart"](8, "button", 4);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵlistener"]("click", function MsDialog_Template_button_click_8_listener() { return ctx.onClick(true); });
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtext"](9);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](4);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtextInterpolate"](ctx.data.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵadvance"](5);
        _angular_core__WEBPACK_IMPORTED_MODULE_1__["ɵɵtextInterpolate"](ctx.data.btn);
    } }, directives: [_angular_material_dialog__WEBPACK_IMPORTED_MODULE_0__["MatDialogTitle"], _angular_material_dialog__WEBPACK_IMPORTED_MODULE_0__["MatDialogContent"], _angular_material_dialog__WEBPACK_IMPORTED_MODULE_0__["MatDialogActions"], _angular_material_button__WEBPACK_IMPORTED_MODULE_2__["MatButton"]], encapsulation: 2 });


/***/ }),

/***/ "dcXB":
/*!********************************************************************************!*\
  !*** ./src/app/dating/components/forms/group-filter/group-filter.component.ts ***!
  \********************************************************************************/
/*! exports provided: GroupFilterComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "GroupFilterComponent", function() { return GroupFilterComponent; });
/* harmony import */ var _angular_common_http__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/common/http */ "tk/3");
/* harmony import */ var _angular_forms__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/forms */ "3Pt+");
/* harmony import */ var _angular_material_dialog__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @angular/material/dialog */ "0IaG");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var src_app_services_data_service__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! src/app/services/data.service */ "EnSQ");
/* harmony import */ var _angular_router__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @angular/router */ "tyNb");
/* harmony import */ var src_app_services_http_service__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! src/app/services/http.service */ "N+K7");
/* harmony import */ var src_app_navigation_service__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! src/app/navigation.service */ "2NUr");
/* harmony import */ var _angular_material_button__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! @angular/material/button */ "bTqV");
/* harmony import */ var _angular_material_icon__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! @angular/material/icon */ "NFeN");
/* harmony import */ var _angular_material_progress_bar__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! @angular/material/progress-bar */ "bv9b");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _angular_material_slider__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! @angular/material/slider */ "5RNC");















function GroupFilterComponent_form_10_fieldset_1_Template(rf, ctx) { if (rf & 1) {
    const _r4 = _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵgetCurrentView"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](0, "fieldset");
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](1, "legend");
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](3, "div", 8);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵtext"](4);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](5, "mat-slider", 9);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵlistener"]("input", function GroupFilterComponent_form_10_fieldset_1_Template_mat_slider_input_5_listener($event) { _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵrestoreView"](_r4); const item_r2 = ctx.$implicit; const ctx_r3 = _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵnextContext"](2); return ctx_r3.onData(item_r2.name, $event); });
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
} if (rf & 2) {
    const item_r2 = ctx.$implicit;
    const ctx_r1 = _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵnextContext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵtextInterpolate"](item_r2.name);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵtextInterpolate"](item_r2.options[ctx_r1.formGroup.controls[item_r2.name].value].viewValue);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵproperty"]("max", item_r2.options.length - 1)("formControlName", item_r2.name);
} }
function GroupFilterComponent_form_10_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](0, "form", 6);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵtemplate"](1, GroupFilterComponent_form_10_fieldset_1_Template, 6, 4, "fieldset", 7);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r0 = _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵproperty"]("formGroup", ctx_r0.formGroup);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵproperty"]("ngForOf", ctx_r0.setting.items);
} }
// distance bar also, not just calendar bar
class GroupFilterComponent {
    constructor(fb, dialogRef, data, dataService, activatedRoute, httpService, navService) {
        this.fb = fb;
        this.dialogRef = dialogRef;
        this.data = data;
        this.dataService = dataService;
        this.activatedRoute = activatedRoute;
        this.httpService = httpService;
        this.navService = navService;
        this.progress = { mode: 'determine', value: 0, color: 'primary' };
        this.url = '/user/settings';
        let actionUrl = this.activatedRoute['_routerState'].snapshot.url.replace('/base', '');
        actionUrl = actionUrl.substring(1);
        this.key = actionUrl.substring(actionUrl.indexOf('/'));
    }
    onData(key, evt) {
        this.formGroup.controls[key].setValue(evt.value);
    }
    ngOnInit() {
        let params = new _angular_common_http__WEBPACK_IMPORTED_MODULE_0__["HttpParams"]();
        params = params.set('key', this.key);
        this.httpService.get(this.url, params).subscribe({
            next: (result) => {
                let formGroup = new _angular_forms__WEBPACK_IMPORTED_MODULE_1__["FormGroup"]({});
                this.setting = result;
                this.setting.items.map((item) => {
                    switch (item.type) {
                        case 'os':
                            formGroup.addControl(item.name, new _angular_forms__WEBPACK_IMPORTED_MODULE_1__["FormControl"]([...item.data]));
                        default:
                    }
                });
                this.formGroup = formGroup;
            },
            error: (error) => {
                this.progress.mode = 'determine';
                this.progress.color = 'warn';
            },
            complete: () => {
                console.log('complete');
            },
        });
    }
    onClick() {
        if (this.formGroup.valid) {
            let raw = this.formGroup.getRawValue();
            let items = this.setting.items.map((item) => {
                if (raw[item.name] instanceof Array) {
                    item.data = [...raw[item.name]];
                }
                else {
                    item.data = [raw[item.name]];
                }
                return item;
            });
            this.setting.items = items;
            let params = new _angular_common_http__WEBPACK_IMPORTED_MODULE_0__["HttpParams"]();
            params = params.set('key', this.key);
            this.httpService.save(this.url, this.setting, params).subscribe({
                next: (result) => {
                    this.dialogRef.close(result['items']);
                },
                error: (error) => {
                    this.progress.mode = 'determine';
                    this.progress.color = 'warn';
                },
                complete: () => {
                    this.progress.mode = 'determine';
                },
            });
        }
    }
    back() {
        this.dialogRef.close();
    }
}
GroupFilterComponent.ɵfac = function GroupFilterComponent_Factory(t) { return new (t || GroupFilterComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵdirectiveInject"](_angular_forms__WEBPACK_IMPORTED_MODULE_1__["FormBuilder"]), _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵdirectiveInject"](_angular_material_dialog__WEBPACK_IMPORTED_MODULE_2__["MatDialogRef"]), _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵdirectiveInject"](_angular_material_dialog__WEBPACK_IMPORTED_MODULE_2__["MAT_DIALOG_DATA"]), _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵdirectiveInject"](src_app_services_data_service__WEBPACK_IMPORTED_MODULE_4__["DataService"]), _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵdirectiveInject"](_angular_router__WEBPACK_IMPORTED_MODULE_5__["ActivatedRoute"]), _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵdirectiveInject"](src_app_services_http_service__WEBPACK_IMPORTED_MODULE_6__["HttpService"]), _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵdirectiveInject"](src_app_navigation_service__WEBPACK_IMPORTED_MODULE_7__["NavigationService"])); };
GroupFilterComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵdefineComponent"]({ type: GroupFilterComponent, selectors: [["app-group-filter"]], decls: 11, vars: 4, consts: [["mat-dialog-title", ""], ["mat-icon-button", "", 1, "mat-cancel", 3, "click"], ["mat-icon-button", "", 1, "mat-close", 3, "click"], [3, "mode", "value", "color"], ["mat-dialog-content", "", 1, "mat-form"], ["default", "", 3, "formGroup", 4, "ngIf"], ["default", "", 3, "formGroup"], [4, "ngFor", "ngForOf"], ["legend-right", ""], ["min", "0", 3, "max", "formControlName", "input"]], template: function GroupFilterComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](0, "h1", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](1, "button", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵlistener"]("click", function GroupFilterComponent_Template_button_click_1_listener() { return ctx.back(); });
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](2, "mat-icon");
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵtext"](3, "arrow_backward");
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵtext"](4, " \u00A0 ");
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](5, "button", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵlistener"]("click", function GroupFilterComponent_Template_button_click_5_listener() { return ctx.onClick(); });
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](6, "mat-icon");
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵtext"](7, "done");
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelement"](8, "mat-progress-bar", 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementStart"](9, "div", 4);
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵtemplate"](10, GroupFilterComponent_form_10_Template, 2, 2, "form", 5);
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵadvance"](8);
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵproperty"]("mode", ctx.progress.mode)("value", ctx.progress.value)("color", ctx.progress.color);
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵproperty"]("ngIf", ctx.formGroup);
    } }, directives: [_angular_material_dialog__WEBPACK_IMPORTED_MODULE_2__["MatDialogTitle"], _angular_material_button__WEBPACK_IMPORTED_MODULE_8__["MatButton"], _angular_material_icon__WEBPACK_IMPORTED_MODULE_9__["MatIcon"], _angular_material_progress_bar__WEBPACK_IMPORTED_MODULE_10__["MatProgressBar"], _angular_material_dialog__WEBPACK_IMPORTED_MODULE_2__["MatDialogContent"], _angular_common__WEBPACK_IMPORTED_MODULE_11__["NgIf"], _angular_forms__WEBPACK_IMPORTED_MODULE_1__["ɵangular_packages_forms_forms_ba"], _angular_forms__WEBPACK_IMPORTED_MODULE_1__["NgControlStatusGroup"], _angular_forms__WEBPACK_IMPORTED_MODULE_1__["FormGroupDirective"], _angular_common__WEBPACK_IMPORTED_MODULE_11__["NgForOf"], _angular_material_slider__WEBPACK_IMPORTED_MODULE_12__["MatSlider"], _angular_forms__WEBPACK_IMPORTED_MODULE_1__["NgControlStatus"], _angular_forms__WEBPACK_IMPORTED_MODULE_1__["FormControlName"]], encapsulation: 2 });


/***/ }),

/***/ "dzce":
/*!****************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/svg-path/parse.ts ***!
  \****************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
const length = {
    a: 7,
    c: 6,
    h: 1,
    l: 2,
    m: 2,
    q: 4,
    s: 4,
    t: 2,
    v: 1,
    z: 0
};
const segmentRegExp = /([astvzqmhlc])([^astvzqmhlc]*)/gi;
const numberRegExp = /-?[0-9]*\.?[0-9]+(?:e[-+]?\d+)?/gi;
/* harmony default export */ __webpack_exports__["default"] = ((path) => {
    const segments = (path && path.length > 0 ? path : "M0,0").match(segmentRegExp);
    if (!segments) {
        throw new Error(`No path elements found in string ${path}`);
    }
    return segments.reduce((segmentsArray, segmentString) => {
        let command = segmentString.charAt(0);
        let type = command.toLowerCase();
        const args = parseValues(segmentString.substr(1));
        // overloaded moveTo
        if (type === "m" && args.length > 2) {
            segmentsArray.push([command, ...args.splice(0, 2)]);
            type = "l";
            command = command === "m" ? "l" : "L";
        }
        while (args.length >= 0) {
            if (args.length === length[type]) {
                segmentsArray.push([command, ...args.splice(0, length[type])]);
                break;
            }
            if (args.length < length[type]) {
                throw new Error(`Malformed path data: "${command}" must have ${length[type]} elements and has ${args.length}: ${segmentString}`);
            }
            segmentsArray.push([command, ...args.splice(0, length[type])]);
        }
        return segmentsArray;
    }, []);
});
const parseValues = (args) => {
    const numbers = args.match(numberRegExp);
    return numbers ? numbers.map(Number) : [];
};


/***/ }),

/***/ "f0P/":
/*!********************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/repositories/index.ts ***!
  \********************************************************/
/*! exports provided: Interpolate, Segment */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _interpolate__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./interpolate */ "2qPP");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "Interpolate", function() { return _interpolate__WEBPACK_IMPORTED_MODULE_0__["Interpolate"]; });

/* harmony import */ var _segment__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./segment */ "D+go");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "Segment", function() { return _segment__WEBPACK_IMPORTED_MODULE_1__["Segment"]; });





/***/ }),

/***/ "fJWI":
/*!*****************************************!*\
  !*** ./src/app/app-routing.strategy.ts ***!
  \*****************************************/
/*! exports provided: getUrl, CustomRouteReuseStrategy */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getUrl", function() { return getUrl; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "CustomRouteReuseStrategy", function() { return CustomRouteReuseStrategy; });
function getUrl(route) {
    if (route['_routerState']) {
        return route['_routerState'].url;
    }
}
class CustomRouteReuseStrategy {
    constructor() {
        this.handlers = {};
    }
    shouldDetach(route) {
        if (!route.routeConfig || route.routeConfig.children || route.routeConfig.loadChildren) {
            return false;
        }
        let shouldReuse = false;
        console.log('[router-reuse] checking if this route should be re used or not', route);
        if (route.routeConfig.data) {
            route.routeConfig.data.reuse
                ? (shouldReuse = true)
                : (shouldReuse = false);
        }
        return shouldReuse;
    }
    store(route, handler) {
        console.log('[router-reuse] storing handler');
        if (handler) {
            this.handlers[getUrl(route)] = handler;
        }
    }
    shouldAttach(route) {
        return !!route.routeConfig && !!this.handlers[getUrl(route)];
    }
    retrieve(route) {
        if (!route.routeConfig || route.routeConfig.children || route.routeConfig.loadChildren) {
            return null;
        }
        return this.handlers[getUrl(route)]
            ? this.handlers[getUrl(route)]
            : null;
    }
    shouldReuseRoute(future, curr) {
        if (curr.routeConfig === null) {
            return true;
        }
        return future.data.reuse && future.routeConfig === curr.routeConfig;
    }
}


/***/ }),

/***/ "g+xa":
/*!****************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/svg-path/index.ts ***!
  \****************************************************/
/*! exports provided: svgPathProperties */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "svgPathProperties", function() { return svgPathProperties; });
/* harmony import */ var _svg_path_properties__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./svg-path-properties */ "hX1M");

//https://stackoverflow.com/a/48362715/1086633
class _svgPathProperties {
    constructor(svgPath) {
        this.getTotalLength = () => this.inst.getTotalLength();
        this.getPointAtLength = (fractionLength) => this.inst.getPointAtLength(fractionLength);
        this.getTangentAtLength = (fractionLength) => this.inst.getTangentAtLength(fractionLength);
        this.getPropertiesAtLength = (fractionLength) => this.inst.getPropertiesAtLength(fractionLength);
        this.getParts = () => this.inst.getParts();
        this.inst = new _svg_path_properties__WEBPACK_IMPORTED_MODULE_0__["default"](svgPath);
        if (!(this instanceof svgPathProperties)) {
            return new svgPathProperties(svgPath);
        }
    }
}
const svgPathProperties = _svgPathProperties;


/***/ }),

/***/ "hX1M":
/*!******************************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/svg-path/svg-path-properties.ts ***!
  \******************************************************************/
/*! exports provided: default */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "default", function() { return SVGPathProperties; });
/* harmony import */ var _parse__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./parse */ "dzce");
/* harmony import */ var _linear__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./linear */ "u/oz");
/* harmony import */ var _arc__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./arc */ "ioXe");
/* harmony import */ var _bezier__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./bezier */ "jbY1");




class SVGPathProperties {
    constructor(string) {
        this.length = 0;
        this.partial_lengths = [];
        this.functions = [];
        this.initial_point = null;
        this.getPartAtLength = (fractionLength) => {
            if (fractionLength < 0) {
                fractionLength = 0;
            }
            else if (fractionLength > this.length) {
                fractionLength = this.length;
            }
            let i = this.partial_lengths.length - 1;
            while (this.partial_lengths[i] >= fractionLength && i > 0) {
                i--;
            }
            i++;
            return { fraction: fractionLength - this.partial_lengths[i - 1], i: i };
        };
        this.getTotalLength = () => {
            return this.length;
        };
        this.getPointAtLength = (fractionLength) => {
            const fractionPart = this.getPartAtLength(fractionLength);
            const functionAtPart = this.functions[fractionPart.i];
            if (functionAtPart) {
                return functionAtPart.getPointAtLength(fractionPart.fraction);
            }
            else if (this.initial_point) {
                return this.initial_point;
            }
            throw new Error("Wrong function at this part.");
        };
        this.getTangentAtLength = (fractionLength) => {
            const fractionPart = this.getPartAtLength(fractionLength);
            const functionAtPart = this.functions[fractionPart.i];
            if (functionAtPart) {
                return functionAtPart.getTangentAtLength(fractionPart.fraction);
            }
            else if (this.initial_point) {
                return { x: 0, y: 0 };
            }
            throw new Error("Wrong function at this part.");
        };
        this.getPropertiesAtLength = (fractionLength) => {
            const fractionPart = this.getPartAtLength(fractionLength);
            const functionAtPart = this.functions[fractionPart.i];
            if (functionAtPart) {
                return functionAtPart.getPropertiesAtLength(fractionPart.fraction);
            }
            else if (this.initial_point) {
                return { x: this.initial_point.x, y: this.initial_point.y, tangentX: 0, tangentY: 0 };
            }
            throw new Error("Wrong function at this part.");
        };
        this.getParts = () => {
            const parts = [];
            for (var i = 0; i < this.functions.length; i++) {
                if (this.functions[i] !== null) {
                    this.functions[i] = this.functions[i];
                    const properties = {
                        start: this.functions[i].getPointAtLength(0),
                        end: this.functions[i].getPointAtLength(this.partial_lengths[i] - this.partial_lengths[i - 1]),
                        length: this.partial_lengths[i] - this.partial_lengths[i - 1],
                        getPointAtLength: this.functions[i].getPointAtLength,
                        getTangentAtLength: this.functions[i].getTangentAtLength,
                        getPropertiesAtLength: this.functions[i].getPropertiesAtLength
                    };
                    parts.push(properties);
                }
            }
            return parts;
        };
        const parsed = Object(_parse__WEBPACK_IMPORTED_MODULE_0__["default"])(string);
        let cur = [0, 0];
        let prev_point = [0, 0];
        let curve;
        let ringStart = [0, 0];
        for (let i = 0; i < parsed.length; i++) {
            //moveTo
            if (parsed[i][0] === "M") {
                cur = [parsed[i][1], parsed[i][2]];
                ringStart = [cur[0], cur[1]];
                this.functions.push(null);
                if (i === 0) {
                    this.initial_point = { x: parsed[i][1], y: parsed[i][2] };
                }
            }
            else if (parsed[i][0] === "m") {
                cur = [parsed[i][1] + cur[0], parsed[i][2] + cur[1]];
                ringStart = [cur[0], cur[1]];
                this.functions.push(null);
                //lineTo
            }
            else if (parsed[i][0] === "L") {
                this.length += Math.sqrt(Math.pow(cur[0] - parsed[i][1], 2) + Math.pow(cur[1] - parsed[i][2], 2));
                this.functions.push(new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0], parsed[i][1], cur[1], parsed[i][2]));
                cur = [parsed[i][1], parsed[i][2]];
            }
            else if (parsed[i][0] === "l") {
                this.length += Math.sqrt(Math.pow(parsed[i][1], 2) + Math.pow(parsed[i][2], 2));
                this.functions.push(new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0], parsed[i][1] + cur[0], cur[1], parsed[i][2] + cur[1]));
                cur = [parsed[i][1] + cur[0], parsed[i][2] + cur[1]];
            }
            else if (parsed[i][0] === "H") {
                this.length += Math.abs(cur[0] - parsed[i][1]);
                this.functions.push(new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0], parsed[i][1], cur[1], cur[1]));
                cur[0] = parsed[i][1];
            }
            else if (parsed[i][0] === "h") {
                this.length += Math.abs(parsed[i][1]);
                this.functions.push(new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0], cur[0] + parsed[i][1], cur[1], cur[1]));
                cur[0] = parsed[i][1] + cur[0];
            }
            else if (parsed[i][0] === "V") {
                this.length += Math.abs(cur[1] - parsed[i][1]);
                this.functions.push(new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0], cur[0], cur[1], parsed[i][1]));
                cur[1] = parsed[i][1];
            }
            else if (parsed[i][0] === "v") {
                this.length += Math.abs(parsed[i][1]);
                this.functions.push(new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0], cur[0], cur[1], cur[1] + parsed[i][1]));
                cur[1] = parsed[i][1] + cur[1];
                //Close path
            }
            else if (parsed[i][0] === "z" || parsed[i][0] === "Z") {
                this.length += Math.sqrt(Math.pow(ringStart[0] - cur[0], 2) + Math.pow(ringStart[1] - cur[1], 2));
                this.functions.push(new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0], ringStart[0], cur[1], ringStart[1]));
                cur = [ringStart[0], ringStart[1]];
                //Cubic Bezier curves
            }
            else if (parsed[i][0] === "C") {
                curve = new _bezier__WEBPACK_IMPORTED_MODULE_3__["Bezier"](cur[0], cur[1], parsed[i][1], parsed[i][2], parsed[i][3], parsed[i][4], parsed[i][5], parsed[i][6]);
                this.length += curve.getTotalLength();
                cur = [parsed[i][5], parsed[i][6]];
                this.functions.push(curve);
            }
            else if (parsed[i][0] === "c") {
                curve = new _bezier__WEBPACK_IMPORTED_MODULE_3__["Bezier"](cur[0], cur[1], cur[0] + parsed[i][1], cur[1] + parsed[i][2], cur[0] + parsed[i][3], cur[1] + parsed[i][4], cur[0] + parsed[i][5], cur[1] + parsed[i][6]);
                if (curve.getTotalLength() > 0) {
                    this.length += curve.getTotalLength();
                    this.functions.push(curve);
                    cur = [parsed[i][5] + cur[0], parsed[i][6] + cur[1]];
                }
                else {
                    this.functions.push(new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0], cur[0], cur[1], cur[1]));
                }
            }
            else if (parsed[i][0] === "S") {
                if (i > 0 && ["C", "c", "S", "s"].indexOf(parsed[i - 1][0]) > -1) {
                    if (curve) {
                        const c = curve.getC();
                        curve = new _bezier__WEBPACK_IMPORTED_MODULE_3__["Bezier"](cur[0], cur[1], 2 * cur[0] - c.x, 2 * cur[1] - c.y, parsed[i][1], parsed[i][2], parsed[i][3], parsed[i][4]);
                    }
                }
                else {
                    curve = new _bezier__WEBPACK_IMPORTED_MODULE_3__["Bezier"](cur[0], cur[1], cur[0], cur[1], parsed[i][1], parsed[i][2], parsed[i][3], parsed[i][4]);
                }
                if (curve) {
                    this.length += curve.getTotalLength();
                    cur = [parsed[i][3], parsed[i][4]];
                    this.functions.push(curve);
                }
            }
            else if (parsed[i][0] === "s") {
                //240 225
                if (i > 0 && ["C", "c", "S", "s"].indexOf(parsed[i - 1][0]) > -1) {
                    if (curve) {
                        const c = curve.getC();
                        const d = curve.getD();
                        curve = new _bezier__WEBPACK_IMPORTED_MODULE_3__["Bezier"](cur[0], cur[1], cur[0] + d.x - c.x, cur[1] + d.y - c.y, cur[0] + parsed[i][1], cur[1] + parsed[i][2], cur[0] + parsed[i][3], cur[1] + parsed[i][4]);
                    }
                }
                else {
                    curve = new _bezier__WEBPACK_IMPORTED_MODULE_3__["Bezier"](cur[0], cur[1], cur[0], cur[1], cur[0] + parsed[i][1], cur[1] + parsed[i][2], cur[0] + parsed[i][3], cur[1] + parsed[i][4]);
                }
                if (curve) {
                    this.length += curve.getTotalLength();
                    cur = [parsed[i][3] + cur[0], parsed[i][4] + cur[1]];
                    this.functions.push(curve);
                }
            }
            //Quadratic Bezier curves
            else if (parsed[i][0] === "Q") {
                if (cur[0] == parsed[i][1] && cur[1] == parsed[i][2]) {
                    let linearCurve = new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](parsed[i][1], parsed[i][3], parsed[i][2], parsed[i][4]);
                    this.length += linearCurve.getTotalLength();
                    this.functions.push(linearCurve);
                }
                else {
                    curve = new _bezier__WEBPACK_IMPORTED_MODULE_3__["Bezier"](cur[0], cur[1], parsed[i][1], parsed[i][2], parsed[i][3], parsed[i][4], undefined, undefined);
                    this.length += curve.getTotalLength();
                    this.functions.push(curve);
                }
                cur = [parsed[i][3], parsed[i][4]];
                prev_point = [parsed[i][1], parsed[i][2]];
            }
            else if (parsed[i][0] === "q") {
                if (!(parsed[i][1] == 0 && parsed[i][2] == 0)) {
                    curve = new _bezier__WEBPACK_IMPORTED_MODULE_3__["Bezier"](cur[0], cur[1], cur[0] + parsed[i][1], cur[1] + parsed[i][2], cur[0] + parsed[i][3], cur[1] + parsed[i][4], undefined, undefined);
                    this.length += curve.getTotalLength();
                    this.functions.push(curve);
                }
                else {
                    let linearCurve = new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0] + parsed[i][1], cur[0] + parsed[i][3], cur[1] + parsed[i][2], cur[1] + parsed[i][4]);
                    this.length += linearCurve.getTotalLength();
                    this.functions.push(linearCurve);
                }
                prev_point = [cur[0] + parsed[i][1], cur[1] + parsed[i][2]];
                cur = [parsed[i][3] + cur[0], parsed[i][4] + cur[1]];
            }
            else if (parsed[i][0] === "T") {
                if (i > 0 && ["Q", "q", "T", "t"].indexOf(parsed[i - 1][0]) > -1) {
                    curve = new _bezier__WEBPACK_IMPORTED_MODULE_3__["Bezier"](cur[0], cur[1], 2 * cur[0] - prev_point[0], 2 * cur[1] - prev_point[1], parsed[i][1], parsed[i][2], undefined, undefined);
                    this.functions.push(curve);
                    this.length += curve.getTotalLength();
                }
                else {
                    let linearCurve = new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0], parsed[i][1], cur[1], parsed[i][2]);
                    this.functions.push(linearCurve);
                    this.length += linearCurve.getTotalLength();
                }
                prev_point = [2 * cur[0] - prev_point[0], 2 * cur[1] - prev_point[1]];
                cur = [parsed[i][1], parsed[i][2]];
            }
            else if (parsed[i][0] === "t") {
                if (i > 0 && ["Q", "q", "T", "t"].indexOf(parsed[i - 1][0]) > -1) {
                    curve = new _bezier__WEBPACK_IMPORTED_MODULE_3__["Bezier"](cur[0], cur[1], 2 * cur[0] - prev_point[0], 2 * cur[1] - prev_point[1], cur[0] + parsed[i][1], cur[1] + parsed[i][2], undefined, undefined);
                    this.length += curve.getTotalLength();
                    this.functions.push(curve);
                }
                else {
                    let linearCurve = new _linear__WEBPACK_IMPORTED_MODULE_1__["LinearPosition"](cur[0], cur[0] + parsed[i][1], cur[1], cur[1] + parsed[i][2]);
                    this.length += linearCurve.getTotalLength();
                    this.functions.push(linearCurve);
                }
                prev_point = [2 * cur[0] - prev_point[0], 2 * cur[1] - prev_point[1]];
                cur = [parsed[i][1] + cur[0], parsed[i][2] + cur[0]];
            }
            else if (parsed[i][0] === "A") {
                const arcCurve = new _arc__WEBPACK_IMPORTED_MODULE_2__["Arc"](cur[0], cur[1], parsed[i][1], parsed[i][2], parsed[i][3], parsed[i][4] === 1, parsed[i][5] === 1, parsed[i][6], parsed[i][7]);
                this.length += arcCurve.getTotalLength();
                cur = [parsed[i][6], parsed[i][7]];
                this.functions.push(arcCurve);
            }
            else if (parsed[i][0] === "a") {
                const arcCurve = new _arc__WEBPACK_IMPORTED_MODULE_2__["Arc"](cur[0], cur[1], parsed[i][1], parsed[i][2], parsed[i][3], parsed[i][4] === 1, parsed[i][5] === 1, cur[0] + parsed[i][6], cur[1] + parsed[i][7]);
                this.length += arcCurve.getTotalLength();
                cur = [cur[0] + parsed[i][6], cur[1] + parsed[i][7]];
                this.functions.push(arcCurve);
            }
            this.partial_lengths.push(this.length);
        }
    }
}


/***/ }),

/***/ "ioXe":
/*!**************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/svg-path/arc.ts ***!
  \**************************************************/
/*! exports provided: Arc */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Arc", function() { return Arc; });
class Arc {
    constructor(x0, y0, rx, ry, xAxisRotate, LargeArcFlag, SweepFlag, x1, y1) {
        this.getTotalLength = () => {
            return this.length;
        };
        this.getPointAtLength = (fractionLength) => {
            if (fractionLength < 0) {
                fractionLength = 0;
            }
            else if (fractionLength > this.length) {
                fractionLength = this.length;
            }
            const position = pointOnEllipticalArc({ x: this.x0, y: this.y0 }, this.rx, this.ry, this.xAxisRotate, this.LargeArcFlag, this.SweepFlag, { x: this.x1, y: this.y1 }, fractionLength / this.length);
            return { x: position.x, y: position.y };
        };
        this.getTangentAtLength = (fractionLength) => {
            if (fractionLength < 0) {
                fractionLength = 0;
            }
            else if (fractionLength > this.length) {
                fractionLength = this.length;
            }
            const point_dist = 0.05; // needs testing
            const p1 = this.getPointAtLength(fractionLength);
            let p2;
            if (fractionLength < 0) {
                fractionLength = 0;
            }
            else if (fractionLength > this.length) {
                fractionLength = this.length;
            }
            if (fractionLength < this.length - point_dist) {
                p2 = this.getPointAtLength(fractionLength + point_dist);
            }
            else {
                p2 = this.getPointAtLength(fractionLength - point_dist);
            }
            const xDist = p2.x - p1.x;
            const yDist = p2.y - p1.y;
            const dist = Math.sqrt(xDist * xDist + yDist * yDist);
            if (fractionLength < this.length - point_dist) {
                return { x: -xDist / dist, y: -yDist / dist };
            }
            else {
                return { x: xDist / dist, y: yDist / dist };
            }
        };
        this.getPropertiesAtLength = (fractionLength) => {
            const tangent = this.getTangentAtLength(fractionLength);
            const point = this.getPointAtLength(fractionLength);
            return { x: point.x, y: point.y, tangentX: tangent.x, tangentY: tangent.y };
        };
        this.x0 = x0;
        this.y0 = y0;
        this.rx = rx;
        this.ry = ry;
        this.xAxisRotate = xAxisRotate;
        this.LargeArcFlag = LargeArcFlag;
        this.SweepFlag = SweepFlag;
        this.x1 = x1;
        this.y1 = y1;
        const lengthProperties = approximateArcLengthOfCurve(300, function (t) {
            return pointOnEllipticalArc({ x: x0, y: y0 }, rx, ry, xAxisRotate, LargeArcFlag, SweepFlag, { x: x1, y: y1 }, t);
        });
        this.length = lengthProperties.arcLength;
    }
}
const pointOnEllipticalArc = (p0, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, p1, t) => {
    // In accordance to: http://www.w3.org/TR/SVG/implnote.html#ArcOutOfRangeParameters
    rx = Math.abs(rx);
    ry = Math.abs(ry);
    xAxisRotation = mod(xAxisRotation, 360);
    const xAxisRotationRadians = toRadians(xAxisRotation);
    // If the endpoints are identical, then this is equivalent to omitting the elliptical arc segment entirely.
    if (p0.x === p1.x && p0.y === p1.y) {
        return { x: p0.x, y: p0.y, ellipticalArcAngle: 0 }; // Check if angle is correct
    }
    // If rx = 0 or ry = 0 then this arc is treated as a straight line segment joining the endpoints.
    if (rx === 0 || ry === 0) {
        //return this.pointOnLine(p0, p1, t);
        return { x: 0, y: 0, ellipticalArcAngle: 0 }; // Check if angle is correct
    }
    // Following "Conversion from endpoint to center parameterization"
    // http://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter
    // Step #1: Compute transformedPoint
    const dx = (p0.x - p1.x) / 2;
    const dy = (p0.y - p1.y) / 2;
    const transformedPoint = {
        x: Math.cos(xAxisRotationRadians) * dx + Math.sin(xAxisRotationRadians) * dy,
        y: -Math.sin(xAxisRotationRadians) * dx + Math.cos(xAxisRotationRadians) * dy
    };
    // Ensure radii are large enough
    const radiiCheck = Math.pow(transformedPoint.x, 2) / Math.pow(rx, 2) +
        Math.pow(transformedPoint.y, 2) / Math.pow(ry, 2);
    if (radiiCheck > 1) {
        rx = Math.sqrt(radiiCheck) * rx;
        ry = Math.sqrt(radiiCheck) * ry;
    }
    // Step #2: Compute transformedCenter
    const cSquareNumerator = Math.pow(rx, 2) * Math.pow(ry, 2) -
        Math.pow(rx, 2) * Math.pow(transformedPoint.y, 2) -
        Math.pow(ry, 2) * Math.pow(transformedPoint.x, 2);
    const cSquareRootDenom = Math.pow(rx, 2) * Math.pow(transformedPoint.y, 2) +
        Math.pow(ry, 2) * Math.pow(transformedPoint.x, 2);
    let cRadicand = cSquareNumerator / cSquareRootDenom;
    // Make sure this never drops below zero because of precision
    cRadicand = cRadicand < 0 ? 0 : cRadicand;
    const cCoef = (largeArcFlag !== sweepFlag ? 1 : -1) * Math.sqrt(cRadicand);
    const transformedCenter = {
        x: cCoef * ((rx * transformedPoint.y) / ry),
        y: cCoef * (-(ry * transformedPoint.x) / rx)
    };
    // Step #3: Compute center
    const center = {
        x: Math.cos(xAxisRotationRadians) * transformedCenter.x -
            Math.sin(xAxisRotationRadians) * transformedCenter.y +
            (p0.x + p1.x) / 2,
        y: Math.sin(xAxisRotationRadians) * transformedCenter.x +
            Math.cos(xAxisRotationRadians) * transformedCenter.y +
            (p0.y + p1.y) / 2
    };
    // Step #4: Compute start/sweep angles
    // Start angle of the elliptical arc prior to the stretch and rotate operations.
    // Difference between the start and end angles
    const startVector = {
        x: (transformedPoint.x - transformedCenter.x) / rx,
        y: (transformedPoint.y - transformedCenter.y) / ry
    };
    const startAngle = angleBetween({
        x: 1,
        y: 0
    }, startVector);
    const endVector = {
        x: (-transformedPoint.x - transformedCenter.x) / rx,
        y: (-transformedPoint.y - transformedCenter.y) / ry
    };
    let sweepAngle = angleBetween(startVector, endVector);
    if (!sweepFlag && sweepAngle > 0) {
        sweepAngle -= 2 * Math.PI;
    }
    else if (sweepFlag && sweepAngle < 0) {
        sweepAngle += 2 * Math.PI;
    }
    // We use % instead of `mod(..)` because we want it to be -360deg to 360deg(but actually in radians)
    sweepAngle %= 2 * Math.PI;
    // From http://www.w3.org/TR/SVG/implnote.html#ArcParameterizationAlternatives
    const angle = startAngle + sweepAngle * t;
    const ellipseComponentX = rx * Math.cos(angle);
    const ellipseComponentY = ry * Math.sin(angle);
    const point = {
        x: Math.cos(xAxisRotationRadians) * ellipseComponentX -
            Math.sin(xAxisRotationRadians) * ellipseComponentY +
            center.x,
        y: Math.sin(xAxisRotationRadians) * ellipseComponentX +
            Math.cos(xAxisRotationRadians) * ellipseComponentY +
            center.y,
        ellipticalArcStartAngle: startAngle,
        ellipticalArcEndAngle: startAngle + sweepAngle,
        ellipticalArcAngle: angle,
        ellipticalArcCenter: center,
        resultantRx: rx,
        resultantRy: ry
    };
    return point;
};
const approximateArcLengthOfCurve = (resolution, pointOnCurveFunc) => {
    // Resolution is the number of segments we use
    resolution = resolution ? resolution : 500;
    let resultantArcLength = 0;
    const arcLengthMap = [];
    const approximationLines = [];
    let prevPoint = pointOnCurveFunc(0);
    let nextPoint;
    for (let i = 0; i < resolution; i++) {
        const t = clamp(i * (1 / resolution), 0, 1);
        nextPoint = pointOnCurveFunc(t);
        resultantArcLength += distance(prevPoint, nextPoint);
        approximationLines.push([prevPoint, nextPoint]);
        arcLengthMap.push({
            t: t,
            arcLength: resultantArcLength
        });
        prevPoint = nextPoint;
    }
    // Last stretch to the endpoint
    nextPoint = pointOnCurveFunc(1);
    approximationLines.push([prevPoint, nextPoint]);
    resultantArcLength += distance(prevPoint, nextPoint);
    arcLengthMap.push({
        t: 1,
        arcLength: resultantArcLength
    });
    return {
        arcLength: resultantArcLength,
        arcLengthMap: arcLengthMap,
        approximationLines: approximationLines
    };
};
const mod = (x, m) => {
    return ((x % m) + m) % m;
};
const toRadians = (angle) => {
    return angle * (Math.PI / 180);
};
const distance = (p0, p1) => {
    return Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
};
const clamp = (val, min, max) => {
    return Math.min(Math.max(val, min), max);
};
const angleBetween = (v0, v1) => {
    const p = v0.x * v1.x + v0.y * v1.y;
    const n = Math.sqrt((Math.pow(v0.x, 2) + Math.pow(v0.y, 2)) * (Math.pow(v1.x, 2) + Math.pow(v1.y, 2)));
    const sign = v0.x * v1.y - v0.y * v1.x < 0 ? -1 : 1;
    const angle = sign * Math.acos(p / n);
    return angle;
};


/***/ }),

/***/ "jbY1":
/*!*****************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/svg-path/bezier.ts ***!
  \*****************************************************/
/*! exports provided: Bezier */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Bezier", function() { return Bezier; });
/* harmony import */ var _bezier_functions__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./bezier-functions */ "oBSC");

class Bezier {
    constructor(ax, ay, bx, by, cx, cy, dx, dy) {
        this.getTotalLength = () => {
            return this.length;
        };
        this.getPointAtLength = (length) => {
            const xs = [this.a.x, this.b.x, this.c.x, this.d.x];
            const xy = [this.a.y, this.b.y, this.c.y, this.d.y];
            const t = Object(_bezier_functions__WEBPACK_IMPORTED_MODULE_0__["t2length"])(length, this.length, i => this.getArcLength(xs, xy, i));
            return this.getPoint(xs, xy, t);
        };
        this.getTangentAtLength = (length) => {
            const xs = [this.a.x, this.b.x, this.c.x, this.d.x];
            const xy = [this.a.y, this.b.y, this.c.y, this.d.y];
            const t = Object(_bezier_functions__WEBPACK_IMPORTED_MODULE_0__["t2length"])(length, this.length, i => this.getArcLength(xs, xy, i));
            const derivative = this.getDerivative(xs, xy, t);
            const mdl = Math.sqrt(derivative.x * derivative.x + derivative.y * derivative.y);
            let tangent;
            if (mdl > 0) {
                tangent = { x: derivative.x / mdl, y: derivative.y / mdl };
            }
            else {
                tangent = { x: 0, y: 0 };
            }
            return tangent;
        };
        this.getPropertiesAtLength = (length) => {
            const xs = [this.a.x, this.b.x, this.c.x, this.d.x];
            const xy = [this.a.y, this.b.y, this.c.y, this.d.y];
            const t = Object(_bezier_functions__WEBPACK_IMPORTED_MODULE_0__["t2length"])(length, this.length, i => this.getArcLength(xs, xy, i));
            const derivative = this.getDerivative(xs, xy, t);
            const mdl = Math.sqrt(derivative.x * derivative.x + derivative.y * derivative.y);
            let tangent;
            if (mdl > 0) {
                tangent = { x: derivative.x / mdl, y: derivative.y / mdl };
            }
            else {
                tangent = { x: 0, y: 0 };
            }
            const point = this.getPoint(xs, xy, t);
            return { x: point.x, y: point.y, tangentX: tangent.x, tangentY: tangent.y };
        };
        this.getC = () => {
            return this.c;
        };
        this.getD = () => {
            return this.d;
        };
        this.a = { x: ax, y: ay };
        this.b = { x: bx, y: by };
        this.c = { x: cx, y: cy };
        if (dx !== undefined && dy !== undefined) {
            this.getArcLength = _bezier_functions__WEBPACK_IMPORTED_MODULE_0__["getCubicArcLength"];
            this.getPoint = _bezier_functions__WEBPACK_IMPORTED_MODULE_0__["cubicPoint"];
            this.getDerivative = _bezier_functions__WEBPACK_IMPORTED_MODULE_0__["cubicDerivative"];
            this.d = { x: dx, y: dy };
        }
        else {
            this.getArcLength = _bezier_functions__WEBPACK_IMPORTED_MODULE_0__["getQuadraticArcLength"];
            this.getPoint = _bezier_functions__WEBPACK_IMPORTED_MODULE_0__["quadraticPoint"];
            this.getDerivative = _bezier_functions__WEBPACK_IMPORTED_MODULE_0__["quadraticDerivative"];
            this.d = { x: 0, y: 0 };
        }
        this.length = this.getArcLength([this.a.x, this.b.x, this.c.x, this.d.x], [this.a.y, this.b.y, this.c.y, this.d.y], 1);
    }
}


/***/ }),

/***/ "kVHy":
/*!********************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/repositories/utils.ts ***!
  \********************************************************/
/*! exports provided: DEG, Calc, DefaultDistributor */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "DEG", function() { return DEG; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "Calc", function() { return Calc; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "DefaultDistributor", function() { return DefaultDistributor; });
const DEG = 180 / Math.PI;
class Calc {
    static distance2(p, point) {
        var dx = p.x - point.x, dy = p.y - point.y;
        return dx * dx + dy * dy;
    }
    static getRotation(p1, p2) {
        var dx = p2.x - p1.x;
        var dy = p2.y - p1.y;
        return Math.atan2(dy, dx);
    }
}
class DefaultDistributor {
    static distribute(data, path, bound, value) {
        let points = new Array();
        let totalLength = path.getTotalLength();
        let num = data.num;
        if (!data.values) {
            if (data.closed) {
                let delta = 0;
                if (data.delta !== 0)
                    delta = totalLength / 360 * data.delta; //there is a deviation at heart, it does not matter at circle
                for (let i = 0; i < num; i++) {
                    let length = delta + totalLength / num * i;
                    if (length > totalLength) {
                        length -= totalLength;
                    }
                    let pt = path.getPointAtLength(length);
                    pt.atLength = length;
                    if (value !== undefined) {
                        pt.value = Math.floor(length / totalLength * value);
                    }
                    let len2 = pt.atLength + (pt.atLength === length ? -0.1 : 0.1);
                    let rotation = Calc.getRotation(pt, path.getPointAtLength(len2));
                    pt.rotation = rotation;
                    pt.x = pt.x * bound.wRatio;
                    pt.y = pt.y * bound.hRatio;
                    //pt.id = "handle" + rand(1, 100) + "_" + i;
                    pt.id = "handle_" + i;
                    pt.txt = i;
                    pt.selected = false;
                    pt.picked = false;
                    points.push(pt);
                }
            }
            else {
                for (let i = 0; i < num; i++) {
                    let pt;
                    if (i > 0 && i < num - 1) {
                        let length = totalLength / (num - 1) * i;
                        pt = path.getPointAtLength(length);
                        pt.atLength = length;
                    }
                    else if (i === 0) {
                        pt = path.getPointAtLength(0);
                        pt.atLength = 0;
                    }
                    if (pt) {
                        if (value !== undefined) {
                            pt.value = Math.floor(length / totalLength * value);
                        }
                        let len2 = pt.atLength + (pt.atLength === length ? -0.1 : 0.1);
                        let rotation = Calc.getRotation(pt, path.getPointAtLength(len2));
                        pt.rotation = rotation;
                        pt.x = pt.x * bound.wRatio;
                        pt.y = pt.y * bound.hRatio;
                        //pt.id = "handle" + rand(1, 100) + "_" + i;
                        pt.id = "handle_" + i;
                        pt.txt = i;
                        pt.selected = false;
                        pt.picked = false;
                        points.push(pt);
                    }
                }
            }
        }
        else {
            let num = data.values.length;
            for (let i = 0; i < num; i++) {
                let percent = data.values[i] / (data.limit.max - data.limit.min);
                let length = percent * totalLength;
                let pt = path.getPointAtLength(length);
                pt.atLength = length;
                if (value !== undefined) {
                    pt.value = Math.floor(length / totalLength * value);
                }
                let len2 = pt.atLength + (pt.atLength === length ? -0.1 : 0.1);
                let rotation = Calc.getRotation(pt, path.getPointAtLength(len2));
                pt.rotation = rotation;
                pt.x = pt.x * bound.wRatio;
                pt.y = pt.y * bound.hRatio;
                //pt.id = "handle" + rand(1, 100) + "_" + i;
                pt.id = "handle_" + i;
                pt.txt = i;
                pt.selected = false;
                pt.picked = false;
                points.push(pt);
            }
        }
        return points;
    }
}


/***/ }),

/***/ "oBSC":
/*!***************************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/svg-path/bezier-functions.ts ***!
  \***************************************************************/
/*! exports provided: cubicPoint, cubicDerivative, getCubicArcLength, quadraticPoint, getQuadraticArcLength, quadraticDerivative, t2length */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "cubicPoint", function() { return cubicPoint; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "cubicDerivative", function() { return cubicDerivative; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getCubicArcLength", function() { return getCubicArcLength; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "quadraticPoint", function() { return quadraticPoint; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "getQuadraticArcLength", function() { return getQuadraticArcLength; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "quadraticDerivative", function() { return quadraticDerivative; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "t2length", function() { return t2length; });
/* harmony import */ var _bezier_values__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./bezier-values */ "uqaw");

const cubicPoint = (xs, ys, t) => {
    const x = (1 - t) * (1 - t) * (1 - t) * xs[0] +
        3 * (1 - t) * (1 - t) * t * xs[1] +
        3 * (1 - t) * t * t * xs[2] +
        t * t * t * xs[3];
    const y = (1 - t) * (1 - t) * (1 - t) * ys[0] +
        3 * (1 - t) * (1 - t) * t * ys[1] +
        3 * (1 - t) * t * t * ys[2] +
        t * t * t * ys[3];
    return { x: x, y: y };
};
const cubicDerivative = (xs, ys, t) => {
    const derivative = quadraticPoint([3 * (xs[1] - xs[0]), 3 * (xs[2] - xs[1]), 3 * (xs[3] - xs[2])], [3 * (ys[1] - ys[0]), 3 * (ys[2] - ys[1]), 3 * (ys[3] - ys[2])], t);
    return derivative;
};
const getCubicArcLength = (xs, ys, t) => {
    let z;
    let sum;
    let correctedT;
    /*if (xs.length >= tValues.length) {
          throw new Error('too high n bezier');
        }*/
    const n = 20;
    z = t / 2;
    sum = 0;
    for (let i = 0; i < n; i++) {
        correctedT = z * _bezier_values__WEBPACK_IMPORTED_MODULE_0__["tValues"][n][i] + z;
        sum += _bezier_values__WEBPACK_IMPORTED_MODULE_0__["cValues"][n][i] * BFunc(xs, ys, correctedT);
    }
    return z * sum;
};
const quadraticPoint = (xs, ys, t) => {
    const x = (1 - t) * (1 - t) * xs[0] + 2 * (1 - t) * t * xs[1] + t * t * xs[2];
    const y = (1 - t) * (1 - t) * ys[0] + 2 * (1 - t) * t * ys[1] + t * t * ys[2];
    return { x: x, y: y };
};
const getQuadraticArcLength = (xs, ys, t) => {
    if (t === undefined) {
        t = 1;
    }
    const ax = xs[0] - 2 * xs[1] + xs[2];
    const ay = ys[0] - 2 * ys[1] + ys[2];
    const bx = 2 * xs[1] - 2 * xs[0];
    const by = 2 * ys[1] - 2 * ys[0];
    const A = 4 * (ax * ax + ay * ay);
    const B = 4 * (ax * bx + ay * by);
    const C = bx * bx + by * by;
    if (A === 0) {
        return (t * Math.sqrt(Math.pow(xs[2] - xs[0], 2) + Math.pow(ys[2] - ys[0], 2)));
    }
    const b = B / (2 * A);
    const c = C / A;
    const u = t + b;
    const k = c - b * b;
    const uuk = u * u + k > 0 ? Math.sqrt(u * u + k) : 0;
    const bbk = b * b + k > 0 ? Math.sqrt(b * b + k) : 0;
    const term = b + Math.sqrt(b * b + k) !== 0
        ? k * Math.log(Math.abs((u + uuk) / (b + bbk)))
        : 0;
    return (Math.sqrt(A) / 2) * (u * uuk - b * bbk + term);
};
const quadraticDerivative = (xs, ys, t) => {
    return {
        x: (1 - t) * 2 * (xs[1] - xs[0]) + t * 2 * (xs[2] - xs[1]),
        y: (1 - t) * 2 * (ys[1] - ys[0]) + t * 2 * (ys[2] - ys[1]),
    };
};
function BFunc(xs, ys, t) {
    const xbase = getDerivative(1, t, xs);
    const ybase = getDerivative(1, t, ys);
    const combined = xbase * xbase + ybase * ybase;
    return Math.sqrt(combined);
}
/**
 * Compute the curve derivative (hodograph) at t.
 */
const getDerivative = (derivative, t, vs) => {
    // the derivative of any 't'-less function is zero.
    const n = vs.length - 1;
    let _vs;
    let value;
    if (n === 0) {
        return 0;
    }
    // direct values? compute!
    if (derivative === 0) {
        value = 0;
        for (let k = 0; k <= n; k++) {
            value +=
                _bezier_values__WEBPACK_IMPORTED_MODULE_0__["binomialCoefficients"][n][k] *
                    Math.pow(1 - t, n - k) *
                    Math.pow(t, k) *
                    vs[k];
        }
        return value;
    }
    else {
        // Still some derivative? go down one order, then try
        // for the lower order curve's.
        _vs = new Array(n);
        for (let k = 0; k < n; k++) {
            _vs[k] = n * (vs[k + 1] - vs[k]);
        }
        return getDerivative(derivative - 1, t, _vs);
    }
};
const t2length = (length, totalLength, func) => {
    let error = 1;
    let t = length / totalLength;
    let step = (length - func(t)) / totalLength;
    let numIterations = 0;
    while (error > 0.001) {
        const increasedTLength = func(t + step);
        const increasedTError = Math.abs(length - increasedTLength) / totalLength;
        if (increasedTError < error) {
            error = increasedTError;
            t += step;
        }
        else {
            const decreasedTLength = func(t - step);
            const decreasedTError = Math.abs(length - decreasedTLength) / totalLength;
            if (decreasedTError < error) {
                error = decreasedTError;
                t -= step;
            }
            else {
                step /= 2;
            }
        }
        numIterations++;
        if (numIterations > 500) {
            break;
        }
    }
    return t;
};


/***/ }),

/***/ "pqyF":
/*!***********************************************!*\
  !*** ./src/app/services/event-bus.service.ts ***!
  \***********************************************/
/*! exports provided: EventBusService */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "EventBusService", function() { return EventBusService; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var rxjs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! rxjs */ "qCKp");



class EventBusService {
    constructor() {
        this._select = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._rate = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._rotate = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._grow = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        this._list = new rxjs__WEBPACK_IMPORTED_MODULE_1__["BehaviorSubject"]({});
    }
    get grow() {
        return this._grow;
    }
    get select() {
        return this._select;
    }
    get rate() {
        return this._rate;
    }
    get rotate() {
        return this._rotate;
    }
}
EventBusService.ɵfac = function EventBusService_Factory(t) { return new (t || EventBusService)(); };
EventBusService.ɵprov = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineInjectable"]({ token: EventBusService, factory: EventBusService.ɵfac, providedIn: 'root' });


/***/ }),

/***/ "psLn":
/*!**************************!*\
  !*** ./src/lib/index.ts ***!
  \**************************/
/*! exports provided: MsAction, MsCalendar, MsPanel, MsList, MsEditor, MsQrcode, HEART_DELTA, HEART_FRAME, SvgLoad, MsFrame, MsMenu, MsDialog */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _ms_list__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./ms-list */ "SvDg");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsAction", function() { return _ms_list__WEBPACK_IMPORTED_MODULE_0__["MsAction"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsCalendar", function() { return _ms_list__WEBPACK_IMPORTED_MODULE_0__["MsCalendar"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsPanel", function() { return _ms_list__WEBPACK_IMPORTED_MODULE_0__["MsPanel"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsList", function() { return _ms_list__WEBPACK_IMPORTED_MODULE_0__["MsList"]; });

/* harmony import */ var _ms_editor__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./ms-editor */ "yXop");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsEditor", function() { return _ms_editor__WEBPACK_IMPORTED_MODULE_1__["MsEditor"]; });

/* harmony import */ var _ms_qrcode__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./ms-qrcode */ "JL96");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsQrcode", function() { return _ms_qrcode__WEBPACK_IMPORTED_MODULE_2__["MsQrcode"]; });

/* harmony import */ var _ms_menu__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./ms-menu */ "Re8X");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "HEART_DELTA", function() { return _ms_menu__WEBPACK_IMPORTED_MODULE_3__["HEART_DELTA"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "HEART_FRAME", function() { return _ms_menu__WEBPACK_IMPORTED_MODULE_3__["HEART_FRAME"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "SvgLoad", function() { return _ms_menu__WEBPACK_IMPORTED_MODULE_3__["SvgLoad"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsFrame", function() { return _ms_menu__WEBPACK_IMPORTED_MODULE_3__["MsFrame"]; });

/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsMenu", function() { return _ms_menu__WEBPACK_IMPORTED_MODULE_3__["MsMenu"]; });

/* harmony import */ var _ms_dialog__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./ms-dialog */ "a6ou");
/* harmony reexport (safe) */ __webpack_require__.d(__webpack_exports__, "MsDialog", function() { return _ms_dialog__WEBPACK_IMPORTED_MODULE_4__["MsDialog"]; });








/***/ }),

/***/ "u/oz":
/*!*****************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/svg-path/linear.ts ***!
  \*****************************************************/
/*! exports provided: LinearPosition */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "LinearPosition", function() { return LinearPosition; });
class LinearPosition {
    constructor(x0, x1, y0, y1) {
        this.getTotalLength = () => {
            return Math.sqrt(Math.pow(this.x0 - this.x1, 2) + Math.pow(this.y0 - this.y1, 2));
        };
        this.getPointAtLength = (pos) => {
            let fraction = pos / Math.sqrt(Math.pow(this.x0 - this.x1, 2) + Math.pow(this.y0 - this.y1, 2));
            fraction = Number.isNaN(fraction) ? 1 : fraction;
            const newDeltaX = (this.x1 - this.x0) * fraction;
            const newDeltaY = (this.y1 - this.y0) * fraction;
            return { x: this.x0 + newDeltaX, y: this.y0 + newDeltaY };
        };
        this.getTangentAtLength = (_) => {
            const module = Math.sqrt((this.x1 - this.x0) * (this.x1 - this.x0) + (this.y1 - this.y0) * (this.y1 - this.y0));
            return { x: (this.x1 - this.x0) / module, y: (this.y1 - this.y0) / module };
        };
        this.getPropertiesAtLength = (pos) => {
            const point = this.getPointAtLength(pos);
            const tangent = this.getTangentAtLength(pos);
            return { x: point.x, y: point.y, tangentX: tangent.x, tangentY: tangent.y };
        };
        this.x0 = x0;
        this.x1 = x1;
        this.y0 = y0;
        this.y1 = y1;
    }
}


/***/ }),

/***/ "uqaw":
/*!************************************************************!*\
  !*** ./src/lib/ms-menu/ms-frame/svg-path/bezier-values.ts ***!
  \************************************************************/
/*! exports provided: tValues, cValues, binomialCoefficients */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "tValues", function() { return tValues; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "cValues", function() { return cValues; });
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "binomialCoefficients", function() { return binomialCoefficients; });
// Legendre-Gauss abscissae (xi values, defined at i=n as the roots of the nth order Legendre polynomial Pn(x))
const tValues = [
    [],
    [],
    [
        -0.5773502691896257645091487805019574556476,
        0.5773502691896257645091487805019574556476
    ],
    [
        0,
        -0.7745966692414833770358530799564799221665,
        0.7745966692414833770358530799564799221665
    ],
    [
        -0.3399810435848562648026657591032446872005,
        0.3399810435848562648026657591032446872005,
        -0.8611363115940525752239464888928095050957,
        0.8611363115940525752239464888928095050957
    ],
    [
        0,
        -0.5384693101056830910363144207002088049672,
        0.5384693101056830910363144207002088049672,
        -0.9061798459386639927976268782993929651256,
        0.9061798459386639927976268782993929651256
    ],
    [
        0.6612093864662645136613995950199053470064,
        -0.6612093864662645136613995950199053470064,
        -0.2386191860831969086305017216807119354186,
        0.2386191860831969086305017216807119354186,
        -0.9324695142031520278123015544939946091347,
        0.9324695142031520278123015544939946091347
    ],
    [
        0,
        0.4058451513773971669066064120769614633473,
        -0.4058451513773971669066064120769614633473,
        -0.7415311855993944398638647732807884070741,
        0.7415311855993944398638647732807884070741,
        -0.9491079123427585245261896840478512624007,
        0.9491079123427585245261896840478512624007
    ],
    [
        -0.1834346424956498049394761423601839806667,
        0.1834346424956498049394761423601839806667,
        -0.5255324099163289858177390491892463490419,
        0.5255324099163289858177390491892463490419,
        -0.7966664774136267395915539364758304368371,
        0.7966664774136267395915539364758304368371,
        -0.9602898564975362316835608685694729904282,
        0.9602898564975362316835608685694729904282
    ],
    [
        0,
        -0.8360311073266357942994297880697348765441,
        0.8360311073266357942994297880697348765441,
        -0.9681602395076260898355762029036728700494,
        0.9681602395076260898355762029036728700494,
        -0.3242534234038089290385380146433366085719,
        0.3242534234038089290385380146433366085719,
        -0.6133714327005903973087020393414741847857,
        0.6133714327005903973087020393414741847857
    ],
    [
        -0.1488743389816312108848260011297199846175,
        0.1488743389816312108848260011297199846175,
        -0.4333953941292471907992659431657841622,
        0.4333953941292471907992659431657841622,
        -0.6794095682990244062343273651148735757692,
        0.6794095682990244062343273651148735757692,
        -0.8650633666889845107320966884234930485275,
        0.8650633666889845107320966884234930485275,
        -0.9739065285171717200779640120844520534282,
        0.9739065285171717200779640120844520534282
    ],
    [
        0,
        -0.2695431559523449723315319854008615246796,
        0.2695431559523449723315319854008615246796,
        -0.5190961292068118159257256694586095544802,
        0.5190961292068118159257256694586095544802,
        -0.7301520055740493240934162520311534580496,
        0.7301520055740493240934162520311534580496,
        -0.8870625997680952990751577693039272666316,
        0.8870625997680952990751577693039272666316,
        -0.9782286581460569928039380011228573907714,
        0.9782286581460569928039380011228573907714
    ],
    [
        -0.1252334085114689154724413694638531299833,
        0.1252334085114689154724413694638531299833,
        -0.3678314989981801937526915366437175612563,
        0.3678314989981801937526915366437175612563,
        -0.587317954286617447296702418940534280369,
        0.587317954286617447296702418940534280369,
        -0.7699026741943046870368938332128180759849,
        0.7699026741943046870368938332128180759849,
        -0.9041172563704748566784658661190961925375,
        0.9041172563704748566784658661190961925375,
        -0.9815606342467192506905490901492808229601,
        0.9815606342467192506905490901492808229601
    ],
    [
        0,
        -0.2304583159551347940655281210979888352115,
        0.2304583159551347940655281210979888352115,
        -0.4484927510364468528779128521276398678019,
        0.4484927510364468528779128521276398678019,
        -0.6423493394403402206439846069955156500716,
        0.6423493394403402206439846069955156500716,
        -0.8015780907333099127942064895828598903056,
        0.8015780907333099127942064895828598903056,
        -0.9175983992229779652065478365007195123904,
        0.9175983992229779652065478365007195123904,
        -0.9841830547185881494728294488071096110649,
        0.9841830547185881494728294488071096110649
    ],
    [
        -0.1080549487073436620662446502198347476119,
        0.1080549487073436620662446502198347476119,
        -0.3191123689278897604356718241684754668342,
        0.3191123689278897604356718241684754668342,
        -0.5152486363581540919652907185511886623088,
        0.5152486363581540919652907185511886623088,
        -0.6872929048116854701480198030193341375384,
        0.6872929048116854701480198030193341375384,
        -0.8272013150697649931897947426503949610397,
        0.8272013150697649931897947426503949610397,
        -0.928434883663573517336391139377874264477,
        0.928434883663573517336391139377874264477,
        -0.986283808696812338841597266704052801676,
        0.986283808696812338841597266704052801676
    ],
    [
        0,
        -0.2011940939974345223006283033945962078128,
        0.2011940939974345223006283033945962078128,
        -0.3941513470775633698972073709810454683627,
        0.3941513470775633698972073709810454683627,
        -0.5709721726085388475372267372539106412383,
        0.5709721726085388475372267372539106412383,
        -0.7244177313601700474161860546139380096308,
        0.7244177313601700474161860546139380096308,
        -0.8482065834104272162006483207742168513662,
        0.8482065834104272162006483207742168513662,
        -0.9372733924007059043077589477102094712439,
        0.9372733924007059043077589477102094712439,
        -0.9879925180204854284895657185866125811469,
        0.9879925180204854284895657185866125811469
    ],
    [
        -0.0950125098376374401853193354249580631303,
        0.0950125098376374401853193354249580631303,
        -0.281603550779258913230460501460496106486,
        0.281603550779258913230460501460496106486,
        -0.45801677765722738634241944298357757354,
        0.45801677765722738634241944298357757354,
        -0.6178762444026437484466717640487910189918,
        0.6178762444026437484466717640487910189918,
        -0.7554044083550030338951011948474422683538,
        0.7554044083550030338951011948474422683538,
        -0.8656312023878317438804678977123931323873,
        0.8656312023878317438804678977123931323873,
        -0.9445750230732325760779884155346083450911,
        0.9445750230732325760779884155346083450911,
        -0.9894009349916499325961541734503326274262,
        0.9894009349916499325961541734503326274262
    ],
    [
        0,
        -0.1784841814958478558506774936540655574754,
        0.1784841814958478558506774936540655574754,
        -0.3512317634538763152971855170953460050405,
        0.3512317634538763152971855170953460050405,
        -0.5126905370864769678862465686295518745829,
        0.5126905370864769678862465686295518745829,
        -0.6576711592166907658503022166430023351478,
        0.6576711592166907658503022166430023351478,
        -0.7815140038968014069252300555204760502239,
        0.7815140038968014069252300555204760502239,
        -0.8802391537269859021229556944881556926234,
        0.8802391537269859021229556944881556926234,
        -0.9506755217687677612227169578958030214433,
        0.9506755217687677612227169578958030214433,
        -0.9905754753144173356754340199406652765077,
        0.9905754753144173356754340199406652765077
    ],
    [
        -0.0847750130417353012422618529357838117333,
        0.0847750130417353012422618529357838117333,
        -0.2518862256915055095889728548779112301628,
        0.2518862256915055095889728548779112301628,
        -0.4117511614628426460359317938330516370789,
        0.4117511614628426460359317938330516370789,
        -0.5597708310739475346078715485253291369276,
        0.5597708310739475346078715485253291369276,
        -0.6916870430603532078748910812888483894522,
        0.6916870430603532078748910812888483894522,
        -0.8037049589725231156824174550145907971032,
        0.8037049589725231156824174550145907971032,
        -0.8926024664975557392060605911271455154078,
        0.8926024664975557392060605911271455154078,
        -0.9558239495713977551811958929297763099728,
        0.9558239495713977551811958929297763099728,
        -0.9915651684209309467300160047061507702525,
        0.9915651684209309467300160047061507702525
    ],
    [
        0,
        -0.1603586456402253758680961157407435495048,
        0.1603586456402253758680961157407435495048,
        -0.3165640999636298319901173288498449178922,
        0.3165640999636298319901173288498449178922,
        -0.4645707413759609457172671481041023679762,
        0.4645707413759609457172671481041023679762,
        -0.6005453046616810234696381649462392798683,
        0.6005453046616810234696381649462392798683,
        -0.7209661773352293786170958608237816296571,
        0.7209661773352293786170958608237816296571,
        -0.8227146565371428249789224867127139017745,
        0.8227146565371428249789224867127139017745,
        -0.9031559036148179016426609285323124878093,
        0.9031559036148179016426609285323124878093,
        -0.960208152134830030852778840687651526615,
        0.960208152134830030852778840687651526615,
        -0.9924068438435844031890176702532604935893,
        0.9924068438435844031890176702532604935893
    ],
    [
        -0.0765265211334973337546404093988382110047,
        0.0765265211334973337546404093988382110047,
        -0.227785851141645078080496195368574624743,
        0.227785851141645078080496195368574624743,
        -0.3737060887154195606725481770249272373957,
        0.3737060887154195606725481770249272373957,
        -0.5108670019508270980043640509552509984254,
        0.5108670019508270980043640509552509984254,
        -0.6360536807265150254528366962262859367433,
        0.6360536807265150254528366962262859367433,
        -0.7463319064601507926143050703556415903107,
        0.7463319064601507926143050703556415903107,
        -0.8391169718222188233945290617015206853296,
        0.8391169718222188233945290617015206853296,
        -0.9122344282513259058677524412032981130491,
        0.9122344282513259058677524412032981130491,
        -0.963971927277913791267666131197277221912,
        0.963971927277913791267666131197277221912,
        -0.9931285991850949247861223884713202782226,
        0.9931285991850949247861223884713202782226
    ],
    [
        0,
        -0.1455618541608950909370309823386863301163,
        0.1455618541608950909370309823386863301163,
        -0.288021316802401096600792516064600319909,
        0.288021316802401096600792516064600319909,
        -0.4243421202074387835736688885437880520964,
        0.4243421202074387835736688885437880520964,
        -0.551618835887219807059018796724313286622,
        0.551618835887219807059018796724313286622,
        -0.667138804197412319305966669990339162597,
        0.667138804197412319305966669990339162597,
        -0.7684399634756779086158778513062280348209,
        0.7684399634756779086158778513062280348209,
        -0.8533633645833172836472506385875676702761,
        0.8533633645833172836472506385875676702761,
        -0.9200993341504008287901871337149688941591,
        0.9200993341504008287901871337149688941591,
        -0.9672268385663062943166222149076951614246,
        0.9672268385663062943166222149076951614246,
        -0.9937521706203895002602420359379409291933,
        0.9937521706203895002602420359379409291933
    ],
    [
        -0.0697392733197222212138417961186280818222,
        0.0697392733197222212138417961186280818222,
        -0.2078604266882212854788465339195457342156,
        0.2078604266882212854788465339195457342156,
        -0.3419358208920842251581474204273796195591,
        0.3419358208920842251581474204273796195591,
        -0.4693558379867570264063307109664063460953,
        0.4693558379867570264063307109664063460953,
        -0.5876404035069115929588769276386473488776,
        0.5876404035069115929588769276386473488776,
        -0.6944872631866827800506898357622567712673,
        0.6944872631866827800506898357622567712673,
        -0.7878168059792081620042779554083515213881,
        0.7878168059792081620042779554083515213881,
        -0.8658125777203001365364256370193787290847,
        0.8658125777203001365364256370193787290847,
        -0.9269567721871740005206929392590531966353,
        0.9269567721871740005206929392590531966353,
        -0.9700604978354287271239509867652687108059,
        0.9700604978354287271239509867652687108059,
        -0.994294585482399292073031421161298980393,
        0.994294585482399292073031421161298980393
    ],
    [
        0,
        -0.1332568242984661109317426822417661370104,
        0.1332568242984661109317426822417661370104,
        -0.264135680970344930533869538283309602979,
        0.264135680970344930533869538283309602979,
        -0.390301038030290831421488872880605458578,
        0.390301038030290831421488872880605458578,
        -0.5095014778460075496897930478668464305448,
        0.5095014778460075496897930478668464305448,
        -0.6196098757636461563850973116495956533871,
        0.6196098757636461563850973116495956533871,
        -0.7186613631319501944616244837486188483299,
        0.7186613631319501944616244837486188483299,
        -0.8048884016188398921511184069967785579414,
        0.8048884016188398921511184069967785579414,
        -0.8767523582704416673781568859341456716389,
        0.8767523582704416673781568859341456716389,
        -0.9329710868260161023491969890384229782357,
        0.9329710868260161023491969890384229782357,
        -0.9725424712181152319560240768207773751816,
        0.9725424712181152319560240768207773751816,
        -0.9947693349975521235239257154455743605736,
        0.9947693349975521235239257154455743605736
    ],
    [
        -0.0640568928626056260850430826247450385909,
        0.0640568928626056260850430826247450385909,
        -0.1911188674736163091586398207570696318404,
        0.1911188674736163091586398207570696318404,
        -0.3150426796961633743867932913198102407864,
        0.3150426796961633743867932913198102407864,
        -0.4337935076260451384870842319133497124524,
        0.4337935076260451384870842319133497124524,
        -0.5454214713888395356583756172183723700107,
        0.5454214713888395356583756172183723700107,
        -0.6480936519369755692524957869107476266696,
        0.6480936519369755692524957869107476266696,
        -0.7401241915785543642438281030999784255232,
        0.7401241915785543642438281030999784255232,
        -0.8200019859739029219539498726697452080761,
        0.8200019859739029219539498726697452080761,
        -0.8864155270044010342131543419821967550873,
        0.8864155270044010342131543419821967550873,
        -0.9382745520027327585236490017087214496548,
        0.9382745520027327585236490017087214496548,
        -0.9747285559713094981983919930081690617411,
        0.9747285559713094981983919930081690617411,
        -0.9951872199970213601799974097007368118745,
        0.9951872199970213601799974097007368118745
    ]
];
// Legendre-Gauss weights (wi values, defined by a function linked to in the Bezier primer article)
const cValues = [
    [],
    [],
    [1.0, 1.0],
    [
        0.8888888888888888888888888888888888888888,
        0.5555555555555555555555555555555555555555,
        0.5555555555555555555555555555555555555555
    ],
    [
        0.6521451548625461426269360507780005927646,
        0.6521451548625461426269360507780005927646,
        0.3478548451374538573730639492219994072353,
        0.3478548451374538573730639492219994072353
    ],
    [
        0.5688888888888888888888888888888888888888,
        0.4786286704993664680412915148356381929122,
        0.4786286704993664680412915148356381929122,
        0.2369268850561890875142640407199173626432,
        0.2369268850561890875142640407199173626432
    ],
    [
        0.3607615730481386075698335138377161116615,
        0.3607615730481386075698335138377161116615,
        0.4679139345726910473898703439895509948116,
        0.4679139345726910473898703439895509948116,
        0.1713244923791703450402961421727328935268,
        0.1713244923791703450402961421727328935268
    ],
    [
        0.4179591836734693877551020408163265306122,
        0.3818300505051189449503697754889751338783,
        0.3818300505051189449503697754889751338783,
        0.2797053914892766679014677714237795824869,
        0.2797053914892766679014677714237795824869,
        0.1294849661688696932706114326790820183285,
        0.1294849661688696932706114326790820183285
    ],
    [
        0.3626837833783619829651504492771956121941,
        0.3626837833783619829651504492771956121941,
        0.3137066458778872873379622019866013132603,
        0.3137066458778872873379622019866013132603,
        0.2223810344533744705443559944262408844301,
        0.2223810344533744705443559944262408844301,
        0.1012285362903762591525313543099621901153,
        0.1012285362903762591525313543099621901153
    ],
    [
        0.3302393550012597631645250692869740488788,
        0.1806481606948574040584720312429128095143,
        0.1806481606948574040584720312429128095143,
        0.0812743883615744119718921581105236506756,
        0.0812743883615744119718921581105236506756,
        0.3123470770400028400686304065844436655987,
        0.3123470770400028400686304065844436655987,
        0.2606106964029354623187428694186328497718,
        0.2606106964029354623187428694186328497718
    ],
    [
        0.295524224714752870173892994651338329421,
        0.295524224714752870173892994651338329421,
        0.2692667193099963550912269215694693528597,
        0.2692667193099963550912269215694693528597,
        0.2190863625159820439955349342281631924587,
        0.2190863625159820439955349342281631924587,
        0.1494513491505805931457763396576973324025,
        0.1494513491505805931457763396576973324025,
        0.0666713443086881375935688098933317928578,
        0.0666713443086881375935688098933317928578
    ],
    [
        0.272925086777900630714483528336342189156,
        0.2628045445102466621806888698905091953727,
        0.2628045445102466621806888698905091953727,
        0.2331937645919904799185237048431751394317,
        0.2331937645919904799185237048431751394317,
        0.1862902109277342514260976414316558916912,
        0.1862902109277342514260976414316558916912,
        0.1255803694649046246346942992239401001976,
        0.1255803694649046246346942992239401001976,
        0.0556685671161736664827537204425485787285,
        0.0556685671161736664827537204425485787285
    ],
    [
        0.2491470458134027850005624360429512108304,
        0.2491470458134027850005624360429512108304,
        0.2334925365383548087608498989248780562594,
        0.2334925365383548087608498989248780562594,
        0.2031674267230659217490644558097983765065,
        0.2031674267230659217490644558097983765065,
        0.160078328543346226334652529543359071872,
        0.160078328543346226334652529543359071872,
        0.1069393259953184309602547181939962242145,
        0.1069393259953184309602547181939962242145,
        0.047175336386511827194615961485017060317,
        0.047175336386511827194615961485017060317
    ],
    [
        0.2325515532308739101945895152688359481566,
        0.2262831802628972384120901860397766184347,
        0.2262831802628972384120901860397766184347,
        0.2078160475368885023125232193060527633865,
        0.2078160475368885023125232193060527633865,
        0.1781459807619457382800466919960979955128,
        0.1781459807619457382800466919960979955128,
        0.1388735102197872384636017768688714676218,
        0.1388735102197872384636017768688714676218,
        0.0921214998377284479144217759537971209236,
        0.0921214998377284479144217759537971209236,
        0.0404840047653158795200215922009860600419,
        0.0404840047653158795200215922009860600419
    ],
    [
        0.2152638534631577901958764433162600352749,
        0.2152638534631577901958764433162600352749,
        0.2051984637212956039659240656612180557103,
        0.2051984637212956039659240656612180557103,
        0.1855383974779378137417165901251570362489,
        0.1855383974779378137417165901251570362489,
        0.1572031671581935345696019386238421566056,
        0.1572031671581935345696019386238421566056,
        0.1215185706879031846894148090724766259566,
        0.1215185706879031846894148090724766259566,
        0.0801580871597602098056332770628543095836,
        0.0801580871597602098056332770628543095836,
        0.0351194603317518630318328761381917806197,
        0.0351194603317518630318328761381917806197
    ],
    [
        0.2025782419255612728806201999675193148386,
        0.1984314853271115764561183264438393248186,
        0.1984314853271115764561183264438393248186,
        0.1861610000155622110268005618664228245062,
        0.1861610000155622110268005618664228245062,
        0.1662692058169939335532008604812088111309,
        0.1662692058169939335532008604812088111309,
        0.1395706779261543144478047945110283225208,
        0.1395706779261543144478047945110283225208,
        0.1071592204671719350118695466858693034155,
        0.1071592204671719350118695466858693034155,
        0.0703660474881081247092674164506673384667,
        0.0703660474881081247092674164506673384667,
        0.0307532419961172683546283935772044177217,
        0.0307532419961172683546283935772044177217
    ],
    [
        0.1894506104550684962853967232082831051469,
        0.1894506104550684962853967232082831051469,
        0.1826034150449235888667636679692199393835,
        0.1826034150449235888667636679692199393835,
        0.1691565193950025381893120790303599622116,
        0.1691565193950025381893120790303599622116,
        0.1495959888165767320815017305474785489704,
        0.1495959888165767320815017305474785489704,
        0.1246289712555338720524762821920164201448,
        0.1246289712555338720524762821920164201448,
        0.0951585116824927848099251076022462263552,
        0.0951585116824927848099251076022462263552,
        0.0622535239386478928628438369943776942749,
        0.0622535239386478928628438369943776942749,
        0.0271524594117540948517805724560181035122,
        0.0271524594117540948517805724560181035122
    ],
    [
        0.1794464703562065254582656442618856214487,
        0.1765627053669926463252709901131972391509,
        0.1765627053669926463252709901131972391509,
        0.1680041021564500445099706637883231550211,
        0.1680041021564500445099706637883231550211,
        0.1540457610768102880814315948019586119404,
        0.1540457610768102880814315948019586119404,
        0.1351363684685254732863199817023501973721,
        0.1351363684685254732863199817023501973721,
        0.1118838471934039710947883856263559267358,
        0.1118838471934039710947883856263559267358,
        0.0850361483171791808835353701910620738504,
        0.0850361483171791808835353701910620738504,
        0.0554595293739872011294401653582446605128,
        0.0554595293739872011294401653582446605128,
        0.0241483028685479319601100262875653246916,
        0.0241483028685479319601100262875653246916
    ],
    [
        0.1691423829631435918406564701349866103341,
        0.1691423829631435918406564701349866103341,
        0.1642764837458327229860537764659275904123,
        0.1642764837458327229860537764659275904123,
        0.1546846751262652449254180038363747721932,
        0.1546846751262652449254180038363747721932,
        0.1406429146706506512047313037519472280955,
        0.1406429146706506512047313037519472280955,
        0.1225552067114784601845191268002015552281,
        0.1225552067114784601845191268002015552281,
        0.1009420441062871655628139849248346070628,
        0.1009420441062871655628139849248346070628,
        0.0764257302548890565291296776166365256053,
        0.0764257302548890565291296776166365256053,
        0.0497145488949697964533349462026386416808,
        0.0497145488949697964533349462026386416808,
        0.0216160135264833103133427102664524693876,
        0.0216160135264833103133427102664524693876
    ],
    [
        0.1610544498487836959791636253209167350399,
        0.1589688433939543476499564394650472016787,
        0.1589688433939543476499564394650472016787,
        0.152766042065859666778855400897662998461,
        0.152766042065859666778855400897662998461,
        0.1426067021736066117757461094419029724756,
        0.1426067021736066117757461094419029724756,
        0.1287539625393362276755157848568771170558,
        0.1287539625393362276755157848568771170558,
        0.1115666455473339947160239016817659974813,
        0.1115666455473339947160239016817659974813,
        0.0914900216224499994644620941238396526609,
        0.0914900216224499994644620941238396526609,
        0.0690445427376412265807082580060130449618,
        0.0690445427376412265807082580060130449618,
        0.0448142267656996003328381574019942119517,
        0.0448142267656996003328381574019942119517,
        0.0194617882297264770363120414644384357529,
        0.0194617882297264770363120414644384357529
    ],
    [
        0.1527533871307258506980843319550975934919,
        0.1527533871307258506980843319550975934919,
        0.1491729864726037467878287370019694366926,
        0.1491729864726037467878287370019694366926,
        0.1420961093183820513292983250671649330345,
        0.1420961093183820513292983250671649330345,
        0.1316886384491766268984944997481631349161,
        0.1316886384491766268984944997481631349161,
        0.118194531961518417312377377711382287005,
        0.118194531961518417312377377711382287005,
        0.1019301198172404350367501354803498761666,
        0.1019301198172404350367501354803498761666,
        0.0832767415767047487247581432220462061001,
        0.0832767415767047487247581432220462061001,
        0.0626720483341090635695065351870416063516,
        0.0626720483341090635695065351870416063516,
        0.040601429800386941331039952274932109879,
        0.040601429800386941331039952274932109879,
        0.0176140071391521183118619623518528163621,
        0.0176140071391521183118619623518528163621
    ],
    [
        0.1460811336496904271919851476833711882448,
        0.1445244039899700590638271665537525436099,
        0.1445244039899700590638271665537525436099,
        0.1398873947910731547221334238675831108927,
        0.1398873947910731547221334238675831108927,
        0.132268938633337461781052574496775604329,
        0.132268938633337461781052574496775604329,
        0.1218314160537285341953671771257335983563,
        0.1218314160537285341953671771257335983563,
        0.1087972991671483776634745780701056420336,
        0.1087972991671483776634745780701056420336,
        0.0934444234560338615532897411139320884835,
        0.0934444234560338615532897411139320884835,
        0.0761001136283793020170516533001831792261,
        0.0761001136283793020170516533001831792261,
        0.0571344254268572082836358264724479574912,
        0.0571344254268572082836358264724479574912,
        0.0369537897708524937999506682993296661889,
        0.0369537897708524937999506682993296661889,
        0.0160172282577743333242246168584710152658,
        0.0160172282577743333242246168584710152658
    ],
    [
        0.1392518728556319933754102483418099578739,
        0.1392518728556319933754102483418099578739,
        0.1365414983460151713525738312315173965863,
        0.1365414983460151713525738312315173965863,
        0.1311735047870623707329649925303074458757,
        0.1311735047870623707329649925303074458757,
        0.1232523768105124242855609861548144719594,
        0.1232523768105124242855609861548144719594,
        0.1129322960805392183934006074217843191142,
        0.1129322960805392183934006074217843191142,
        0.1004141444428809649320788378305362823508,
        0.1004141444428809649320788378305362823508,
        0.0859416062170677274144436813727028661891,
        0.0859416062170677274144436813727028661891,
        0.0697964684245204880949614189302176573987,
        0.0697964684245204880949614189302176573987,
        0.0522933351526832859403120512732112561121,
        0.0522933351526832859403120512732112561121,
        0.0337749015848141547933022468659129013491,
        0.0337749015848141547933022468659129013491,
        0.0146279952982722006849910980471854451902,
        0.0146279952982722006849910980471854451902
    ],
    [
        0.1336545721861061753514571105458443385831,
        0.132462039404696617371642464703316925805,
        0.132462039404696617371642464703316925805,
        0.1289057221880821499785953393997936532597,
        0.1289057221880821499785953393997936532597,
        0.1230490843067295304675784006720096548158,
        0.1230490843067295304675784006720096548158,
        0.1149966402224113649416435129339613014914,
        0.1149966402224113649416435129339613014914,
        0.1048920914645414100740861850147438548584,
        0.1048920914645414100740861850147438548584,
        0.0929157660600351474770186173697646486034,
        0.0929157660600351474770186173697646486034,
        0.0792814117767189549228925247420432269137,
        0.0792814117767189549228925247420432269137,
        0.0642324214085258521271696151589109980391,
        0.0642324214085258521271696151589109980391,
        0.0480376717310846685716410716320339965612,
        0.0480376717310846685716410716320339965612,
        0.0309880058569794443106942196418845053837,
        0.0309880058569794443106942196418845053837,
        0.0134118594871417720813094934586150649766,
        0.0134118594871417720813094934586150649766
    ],
    [
        0.1279381953467521569740561652246953718517,
        0.1279381953467521569740561652246953718517,
        0.1258374563468282961213753825111836887264,
        0.1258374563468282961213753825111836887264,
        0.121670472927803391204463153476262425607,
        0.121670472927803391204463153476262425607,
        0.1155056680537256013533444839067835598622,
        0.1155056680537256013533444839067835598622,
        0.1074442701159656347825773424466062227946,
        0.1074442701159656347825773424466062227946,
        0.0976186521041138882698806644642471544279,
        0.0976186521041138882698806644642471544279,
        0.086190161531953275917185202983742667185,
        0.086190161531953275917185202983742667185,
        0.0733464814110803057340336152531165181193,
        0.0733464814110803057340336152531165181193,
        0.0592985849154367807463677585001085845412,
        0.0592985849154367807463677585001085845412,
        0.0442774388174198061686027482113382288593,
        0.0442774388174198061686027482113382288593,
        0.0285313886289336631813078159518782864491,
        0.0285313886289336631813078159518782864491,
        0.0123412297999871995468056670700372915759,
        0.0123412297999871995468056670700372915759
    ]
];
// LUT for binomial coefficient arrays per curve order 'n'
const binomialCoefficients = [[1], [1, 1], [1, 2, 1], [1, 3, 3, 1]];


/***/ }),

/***/ "vY5A":
/*!***************************************!*\
  !*** ./src/app/app-routing.module.ts ***!
  \***************************************/
/*! exports provided: AppRoutingModule */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "AppRoutingModule", function() { return AppRoutingModule; });
/* harmony import */ var _angular_router__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/router */ "tyNb");
/* harmony import */ var _auth_guard_service__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./auth-guard.service */ "5nbR");
/* harmony import */ var _login_login_component__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./login/login.component */ "vtpD");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! @angular/core */ "fXoL");





// https://github.com/Mokkapps/angular-manual-lazy-load-demo/blob/master/src/app/lazy-loader.service.ts
// firebase notification lazy load
// https://github.com/mebjas/html5-qrcode - qr code scanning
// filter, add, attach
const routes = [
    {
        path: 'login',
        component: _login_login_component__WEBPACK_IMPORTED_MODULE_2__["LoginComponent"],
    },
    // dating - can browse events from organizer
    {
        path: 'dating',
        loadChildren: () => Promise.all(/*! import() | dating-dating-module */[__webpack_require__.e("default~business-business-module~dating-dating-module~job-job-module"), __webpack_require__.e("dating-dating-module")]).then(__webpack_require__.bind(null, /*! ./dating/dating.module */ "lxy2")).then((m) => m.DatingModule),
        canLoad: [_auth_guard_service__WEBPACK_IMPORTED_MODULE_1__["AuthGuardService"]],
    },
    // business also can attach event organizer's event as a group event -
    // can set random - (groups has been rated together as in the case of dating)
    // jobs, group invite, idea sharing
    {
        path: 'business',
        loadChildren: () => Promise.all(/*! import() | business-business-module */[__webpack_require__.e("default~business-business-module~dating-dating-module~job-job-module"), __webpack_require__.e("business-business-module")]).then(__webpack_require__.bind(null, /*! ./business/business.module */ "HnZ3")).then((m) => m.BusinessModule),
        canLoad: [_auth_guard_service__WEBPACK_IMPORTED_MODULE_1__["AuthGuardService"]],
    },
    {
        path: 'job',
        loadChildren: () => Promise.all(/*! import() | job-job-module */[__webpack_require__.e("default~business-business-module~dating-dating-module~job-job-module"), __webpack_require__.e("job-job-module")]).then(__webpack_require__.bind(null, /*! ./job/job.module */ "K3ou")).then((m) => m.JobModule),
        canLoad: [_auth_guard_service__WEBPACK_IMPORTED_MODULE_1__["AuthGuardService"]],
    },
];
class AppRoutingModule {
}
AppRoutingModule.ɵfac = function AppRoutingModule_Factory(t) { return new (t || AppRoutingModule)(); };
AppRoutingModule.ɵmod = _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵdefineNgModule"]({ type: AppRoutingModule });
AppRoutingModule.ɵinj = _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵdefineInjector"]({ imports: [[
            _angular_router__WEBPACK_IMPORTED_MODULE_0__["RouterModule"].forRoot(routes, { scrollPositionRestoration: 'enabled' }),
        ], _angular_router__WEBPACK_IMPORTED_MODULE_0__["RouterModule"]] });
(function () { (typeof ngJitMode === "undefined" || ngJitMode) && _angular_core__WEBPACK_IMPORTED_MODULE_3__["ɵɵsetNgModuleScope"](AppRoutingModule, { imports: [_angular_router__WEBPACK_IMPORTED_MODULE_0__["RouterModule"]], exports: [_angular_router__WEBPACK_IMPORTED_MODULE_0__["RouterModule"]] }); })();


/***/ }),

/***/ "vtpD":
/*!******************************************!*\
  !*** ./src/app/login/login.component.ts ***!
  \******************************************/
/*! exports provided: LoginComponent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "LoginComponent", function() { return LoginComponent; });
/* harmony import */ var firebase_app__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! firebase/app */ "Jgta");
/* harmony import */ var firebaseui__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! firebaseui */ "I5iV");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _navigation_service__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ../navigation.service */ "2NUr");
/* harmony import */ var _services_http_service__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ../services/http.service */ "N+K7");
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");
/* harmony import */ var _angular_common__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! @angular/common */ "ofXK");
/* harmony import */ var _lib_ms_menu_index__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ../../lib/ms-menu/index */ "Re8X");








function LoginComponent_p_8_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "p", 29);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r0 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtextInterpolate1"]("v", ctx_r0.msg["expl.version"], "");
} }
function LoginComponent_h3_9_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "h3", 30);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](1, "Server is down!");
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} }
function LoginComponent_div_13_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "div", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](1, "div", 31);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](2, "div", 32);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](3, "div", 33);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](4);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r2 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("innerHtml", ctx_r2.msg["expl.build"], _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵsanitizeHtml"]);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](3);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtextInterpolate"](ctx_r2.msg["expl.loading"]);
} }
function LoginComponent_div_14_iframe_3_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](0, "iframe", 35);
} }
function LoginComponent_div_14_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "div", 10);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](1, "h2");
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](3, LoginComponent_div_14_iframe_3_Template, 1, 0, "iframe", 34);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r3 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](2);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtextInterpolate"](ctx_r3.msg["expl.intro"]);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngForOf", ctx_r3.msg["expl.videos"]);
} }
function LoginComponent_div_15_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](0, "div", 36);
} if (rf & 2) {
    const ctx_r4 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("innerHtml", ctx_r4.msg["expl.time"], _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵsanitizeHtml"]);
} }
function LoginComponent_div_16_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](0, "div", 36);
} if (rf & 2) {
    const ctx_r5 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("innerHtml", ctx_r5.msg["expl.priority"], _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵsanitizeHtml"]);
} }
function LoginComponent_div_17_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](0, "div", 36);
} if (rf & 2) {
    const ctx_r6 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("innerHtml", ctx_r6.msg["expl.group_dating"], _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵsanitizeHtml"]);
} }
function LoginComponent_div_18_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](0, "div", 36);
} if (rf & 2) {
    const ctx_r7 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("innerHtml", ctx_r7.msg["expl.equal_opportunity"], _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵsanitizeHtml"]);
} }
function LoginComponent_div_19_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](0, "div", 36);
} if (rf & 2) {
    const ctx_r8 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("innerHtml", ctx_r8.msg["expl.security"], _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵsanitizeHtml"]);
} }
function LoginComponent_h2_21_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "h2");
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r9 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtextInterpolate"](ctx_r9.msg["expl.report"]);
} }
function LoginComponent_h2_30_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "h2");
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r10 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtextInterpolate"](ctx_r10.msg["expl.follow"]);
} }
function LoginComponent_div_52_Template(rf, ctx) { if (rf & 1) {
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "div");
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
} if (rf & 2) {
    const ctx_r11 = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵnextContext"]();
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
    _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtextInterpolate1"](", v", ctx_r11.msg["expl.version"], "");
} }
const uiConfig = {
    callbacks: {
        signInSuccessWithAuthResult(authResult, redirectUrl) {
            return false;
        },
        uiShown() {
            console.log('aaaaa');
            document.getElementById('loader').style.display = 'none';
        },
    },
    // signInFlow: 'popup',
    signInOptions: [
        firebase_app__WEBPACK_IMPORTED_MODULE_0__["default"].auth.GoogleAuthProvider.PROVIDER_ID,
        firebase_app__WEBPACK_IMPORTED_MODULE_0__["default"].auth.FacebookAuthProvider.PROVIDER_ID,
        firebase_app__WEBPACK_IMPORTED_MODULE_0__["default"].auth.EmailAuthProvider.PROVIDER_ID,
    ],
    tosUrl: 'https://www.termsfeed.com/live/db6d4315-9907-46cd-929f-868630e81f69',
    privacyPolicyUrl: 'https://www.termsfeed.com/live/bab86d2c-6ed7-4fa2-8f8e-eda206765d42',
};
class LoginComponent {
    constructor(navService, httpService, domSanitizer) {
        this.navService = navService;
        this.httpService = httpService;
        this.domSanitizer = domSanitizer;
        this.server = true;
    }
    ngOnInit() {
        if (this.navService.locale === undefined) {
            this.httpService.get('/messages').subscribe({
                next: (value) => {
                    const evt = value['msg'];
                    if (evt['expl.videos']) {
                        evt['expl.videos'] = evt['expl.videos'].map((video) => this.domSanitizer.bypassSecurityTrustResourceUrl(video));
                    }
                    this.navService.locale = evt;
                    this.msg = this.navService.locale;
                    this.initFirebase();
                },
                error: (error) => {
                    console.log('Server is down!');
                },
                complete: () => { },
            });
        }
        else {
            this.msg = this.navService.locale;
            this.initFirebase();
        }
    }
    initFirebase() {
        setTimeout(() => {
            const ui = firebaseui__WEBPACK_IMPORTED_MODULE_1__["auth"].AuthUI.getInstance() ||
                new firebaseui__WEBPACK_IMPORTED_MODULE_1__["auth"].AuthUI(firebase_app__WEBPACK_IMPORTED_MODULE_0__["default"].auth());
            ui.start('#firebaseui-auth-container', uiConfig);
        });
    }
}
LoginComponent.ɵfac = function LoginComponent_Factory(t) { return new (t || LoginComponent)(_angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_navigation_service__WEBPACK_IMPORTED_MODULE_3__["NavigationService"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_services_http_service__WEBPACK_IMPORTED_MODULE_4__["HttpService"]), _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdirectiveInject"](_angular_platform_browser__WEBPACK_IMPORTED_MODULE_5__["DomSanitizer"])); };
LoginComponent.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵdefineComponent"]({ type: LoginComponent, selectors: [["app-login"]], decls: 53, vars: 12, consts: [[1, "mat-intro-background"], [1, "mat-into-header"], ["src", "assets/img/logo/logo.png"], [1, "info", 2, "display", "grid", "text-align", "center"], [1, "mobile-only"], ["class", "version", 4, "ngIf"], ["class", "server-msg", 4, "ngIf"], [1, "addToHome"], ["class", "mat-into-panel", 4, "ngIf"], ["class", "mat-into-panel", 3, "innerHtml", 4, "ngIf"], [1, "mat-into-panel"], [4, "ngIf"], [1, "btn_bar"], [2, "display", "flex", "grid-area", "1 / 1"], [1, "btn_base"], [1, "github", "container"], ["href", "https://github.com/myscoutee/myscoutee", "target", "_blank"], [1, "img"], [2, "grid-area", "1 / 1", "pointer-events", "none"], [2, "display", "flex"], [1, "youtube", "container"], ["href", "https://www.youtube.com/channel/UC3J3oi23kHx-8PKYJ2hxcdA", "target", "_blank"], [1, "facebook", "container"], ["href", "https://www.facebook.com/MyScouteeT", "target", "_blank"], [1, "twitter", "container"], ["href", "https://twitter.com/MyScoutee", "target", "_blank"], [1, "linkedin", "container"], ["href", "https://www.linkedin.com/company/myscoutee", "target", "_blank"], [1, "mat-into-footer"], [1, "version"], [1, "server-msg"], [3, "innerHtml"], ["id", "firebaseui-auth-container"], ["id", "loader"], ["width", "100%", "height", "200vh", "src", "https://www.youtube.com/embed/videoseries?list=PLxtLUXGICqdHaHC36Dv1t2IVchqwA7uz4", "title", "YouTube video player", "frameborder", "0", "allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", "allowfullscreen", "", 4, "ngFor", "ngForOf"], ["width", "100%", "height", "200vh", "src", "https://www.youtube.com/embed/videoseries?list=PLxtLUXGICqdHaHC36Dv1t2IVchqwA7uz4", "title", "YouTube video player", "frameborder", "0", "allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", "allowfullscreen", ""], [1, "mat-into-panel", 3, "innerHtml"]], template: function LoginComponent_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](0, "div", 0);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](1, "div", 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](2, "img", 2);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](3, "h1");
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](4, "yScoutee");
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](5, "div", 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](6, "p", 4);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](7, "Mobile Only");
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](8, LoginComponent_p_8_Template, 2, 1, "p", 5);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](9, LoginComponent_h3_9_Template, 2, 0, "h3", 6);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](10, "div", 7);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](11, "h3");
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](12, "Add to home screen to enable notification!");
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](13, LoginComponent_div_13_Template, 5, 2, "div", 8);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](14, LoginComponent_div_14_Template, 4, 2, "div", 8);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](15, LoginComponent_div_15_Template, 1, 1, "div", 9);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](16, LoginComponent_div_16_Template, 1, 1, "div", 9);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](17, LoginComponent_div_17_Template, 1, 1, "div", 9);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](18, LoginComponent_div_18_Template, 1, 1, "div", 9);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](19, LoginComponent_div_19_Template, 1, 1, "div", 9);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](20, "div", 10);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](21, LoginComponent_h2_21_Template, 2, 1, "h2", 11);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](22, "div", 12);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](23, "div", 13);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](24, "div", 14);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](25, "div", 15);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](26, "a", 16);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](27, "img", 17);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](28, "ms-menu", 18);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](29, "div", 10);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](30, LoginComponent_h2_30_Template, 2, 1, "h2", 11);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](31, "div", 12);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](32, "div", 19);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](33, "div", 14);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](34, "div", 20);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](35, "a", 21);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](36, "img", 17);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](37, "div", 14);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](38, "div", 22);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](39, "a", 23);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](40, "img", 17);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](41, "div", 14);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](42, "div", 24);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](43, "a", 25);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](44, "img", 17);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](45, "div", 14);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](46, "div", 26);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](47, "a", 27);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelement"](48, "img", 17);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](49, "div", 28);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementStart"](50, "h3", 19);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtext"](51, " \u00A9 MyScoutee.com, All Rights Reserved ");
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵtemplate"](52, LoginComponent_div_52_Template, 2, 1, "div", 11);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](8);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", !ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](4);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](1);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](9);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵadvance"](22);
        _angular_core__WEBPACK_IMPORTED_MODULE_2__["ɵɵproperty"]("ngIf", ctx.msg);
    } }, directives: [_angular_common__WEBPACK_IMPORTED_MODULE_6__["NgIf"], _lib_ms_menu_index__WEBPACK_IMPORTED_MODULE_7__["MsMenu"], _angular_common__WEBPACK_IMPORTED_MODULE_6__["NgForOf"]], encapsulation: 2 });


/***/ }),

/***/ "yXop":
/*!************************************!*\
  !*** ./src/lib/ms-editor/index.ts ***!
  \************************************/
/*! exports provided: MsEditor */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, "MsEditor", function() { return MsEditor; });
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _magnifier__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./magnifier */ "3d5Q");
/* harmony import */ var src_app_services_event_bus_service__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! src/app/services/event-bus.service */ "pqyF");




const _c0 = ["editor"];
const _c1 = ["item"];
//no rotate buttons - it should be on multi touch
//it will be zoomable calendar - create element, not just for image
class MsEditor {
    constructor(_renderer, navService) {
        this._renderer = _renderer;
        this.navService = navService;
        this.changed = new _angular_core__WEBPACK_IMPORTED_MODULE_0__["EventEmitter"]();
        if (this.data !== undefined) {
            this.data.src = this.data.src + '?' + Date.now();
        }
    }
    ngOnChanges(changes) {
        this.notify();
    }
    loaded(evt) {
        if (this.data.value !== undefined) {
            this.update(this.data.value.mtx);
        }
    }
    // init
    ngOnInit() {
        this.notify();
        /*QRCode.toCanvas(this.canvasRef.nativeElement, 'sample text', function (error) {
                if (error) console.error(error)
                console.log('success!');
            });*/
        let transform = new _magnifier__WEBPACK_IMPORTED_MODULE_1__["Transform"]();
        if (this.data.value !== undefined) {
            transform = new _magnifier__WEBPACK_IMPORTED_MODULE_1__["Transform"](this.data.value.matrix);
        }
        this.magnifier = new _magnifier__WEBPACK_IMPORTED_MODULE_1__["Magnifier"](this.editorRef.nativeElement, this._renderer, transform);
        this.magnifier.listen((mtx) => {
            this.update(mtx);
        });
        this.navService.rotate.subscribe((tr) => {
            const mtx = this.magnifier.rotate(tr.degree);
            this.update(mtx);
        });
    }
    update(mtx) {
        this._renderer.setStyle(this.itemRef.nativeElement, 'transform', 'translate(' +
            mtx.pos.x +
            'px,' +
            mtx.pos.y +
            'px) scale(' +
            mtx.scale +
            ',' +
            mtx.scale +
            ') rotate(' +
            mtx.angle +
            'deg)');
        this.changed.emit({ mtx });
    }
    notify() {
        setTimeout(() => {
            this.changed.emit({
                mtx: this.magnifier.transform.mtx,
                img: this.itemRef.nativeElement,
                size: {
                    height: this.editorRef.nativeElement.clientHeight,
                    width: this.editorRef.nativeElement.clientWidth,
                },
            });
        });
    }
}
MsEditor.ɵfac = function MsEditor_Factory(t) { return new (t || MsEditor)(_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](_angular_core__WEBPACK_IMPORTED_MODULE_0__["Renderer2"]), _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdirectiveInject"](src_app_services_event_bus_service__WEBPACK_IMPORTED_MODULE_2__["EventBusService"])); };
MsEditor.ɵcmp = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵdefineComponent"]({ type: MsEditor, selectors: [["ms-editor"]], viewQuery: function MsEditor_Query(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c0, 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵviewQuery"](_c1, 3);
    } if (rf & 2) {
        let _t;
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.editorRef = _t.first);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵqueryRefresh"](_t = _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵloadQuery"]()) && (ctx.itemRef = _t.first);
    } }, inputs: { data: "data" }, outputs: { changed: "changed" }, features: [_angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵNgOnChangesFeature"]], decls: 4, vars: 1, consts: [[1, "editor"], ["editor", ""], [1, "img", 3, "src", "load"], ["item", ""]], template: function MsEditor_Template(rf, ctx) { if (rf & 1) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](0, "div", 0, 1);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementStart"](2, "img", 2, 3);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵlistener"]("load", function MsEditor_Template_img_load_2_listener($event) { return ctx.loaded($event); });
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵelementEnd"]();
    } if (rf & 2) {
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵadvance"](2);
        _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵproperty"]("src", ctx.data.src, _angular_core__WEBPACK_IMPORTED_MODULE_0__["ɵɵsanitizeUrl"]);
    } }, encapsulation: 2 });


/***/ }),

/***/ "zUnb":
/*!*********************!*\
  !*** ./src/main.ts ***!
  \*********************/
/*! no exports provided */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @angular/platform-browser */ "jhN1");
/* harmony import */ var _angular_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @angular/core */ "fXoL");
/* harmony import */ var _app_app_module__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./app/app.module */ "ZAI4");
/* harmony import */ var _environments_environment__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./environments/environment */ "AytR");




//https://juristr.com/blog/2016/11/configure-proxy-api-angular-cli/
if (_environments_environment__WEBPACK_IMPORTED_MODULE_3__["environment"].production) {
    Object(_angular_core__WEBPACK_IMPORTED_MODULE_1__["enableProdMode"])();
}
_angular_platform_browser__WEBPACK_IMPORTED_MODULE_0__["platformBrowser"]()
    .bootstrapModule(_app_app_module__WEBPACK_IMPORTED_MODULE_2__["AppModule"])
    .catch((err) => {
    console.log(err);
});


/***/ }),

/***/ "zn8P":
/*!******************************************************!*\
  !*** ./$$_lazy_route_resource lazy namespace object ***!
  \******************************************************/
/*! no static exports found */
/***/ (function(module, exports) {

function webpackEmptyAsyncContext(req) {
	// Here Promise.resolve().then() is used instead of new Promise() to prevent
	// uncaught exception popping up in devtools
	return Promise.resolve().then(function() {
		var e = new Error("Cannot find module '" + req + "'");
		e.code = 'MODULE_NOT_FOUND';
		throw e;
	});
}
webpackEmptyAsyncContext.keys = function() { return []; };
webpackEmptyAsyncContext.resolve = webpackEmptyAsyncContext;
module.exports = webpackEmptyAsyncContext;
webpackEmptyAsyncContext.id = "zn8P";

/***/ })

},[[0,"runtime","vendor"]]]);
//# sourceMappingURL=main-es2015.js.map