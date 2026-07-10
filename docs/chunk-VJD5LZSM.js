import{E as U,F as Be,G as sn,H as te,I as Nn,J as Wi,K as we,O as Et,P as at,Q as At,R as Pt,S as ln,T as Hn,U as qi,V as $i,X as Xi,Y as pe,Z as Ui,_ as me,a as qe,ba as Ki,c as Ni,ca as Gi,d as mt,da as Yn,e as Le,ea as jn,f as Hi,fa as Y,g as Zt,ga as ze,h as Qt,ha as Zi,j as Jt,k as en,la as dn,ma as Qi,n as tn,oa as cn,ra as Ji,ta as ea,u as nn,ua as pn,w as Yi,wa as ta,y as ji}from"./chunk-C3OOD4RV.js";import{a as Ce,b as an,d as le,e as ge,f as on,g as rn}from"./chunk-HT62GCX7.js";import{c as Bi,e as Kt,h as zi,k as Gt}from"./chunk-5PQ6VHW3.js";import{a as Fe}from"./chunk-RXJZSKLJ.js";import{$ as s,$a as kt,$b as W,A as Ae,B as In,Bb as ke,Bc as St,Ca as ki,Cb as Me,Cc as Ee,Db as b,Eb as c,Ec as Xt,F as wi,Fb as p,Fc as Ut,Gb as ne,Gc as Z,Hb as G,Hc as it,Ib as J,Ic as Oi,Jb as xe,Jc as Ii,K as Rn,Kc as Ri,Lb as R,Lc as ee,M as Vn,Mb as se,O as Je,Oc as P,Pb as f,Pc as Vi,Q as he,Qb as Nt,Qc as Fi,R as Di,Rb as d,Rc as Li,Sb as ie,Tb as z,Ub as Ht,V as pt,Va as l,Vb as _e,W as H,Wb as F,X as q,Xb as L,Yb as Ai,Z as B,Zb as Yt,_ as Bt,_a as ye,_b as Mt,a as Oe,ab as Re,ac as tt,b as yi,bb as Q,bc as D,ca as zt,cb as Mi,cc as We,db as Si,dc as _,e as N,ea as u,eb as De,ec as k,fa as h,fb as Ln,fc as Se,g as Lt,ga as et,gc as zn,h as O,ha as Fn,ia as j,ic as jt,ja as re,jb as E,jc as Wt,k as xi,kb as $,kc as qt,lb as I,m as ct,ma as M,na as V,nb as ce,ob as Ve,pc as X,qb as Ei,qc as nt,r as Ci,ra as T,sc as Pi,ta as Ie,tc as Ti,ua as fe,ub as Bn,va as je,vb as w,vc as Pe,wa as A,wc as Te,xb as v,yb as y,yc as $t,z as Qe}from"./chunk-K4FOD347.js";var uo=["mat-icon-button",""],ho=["*"],fo=new B("MAT_BUTTON_CONFIG");function na(i){return i==null?void 0:Vi(i)}var Wn=(()=>{class i{_elementRef=s(A);_ngZone=s(V);_animationsDisabled=we();_config=s(fo,{optional:!0});_focusMonitor=s(ln);_cleanupClick;_renderer=s(Q);_rippleLoader=s(ea);_isAnchor;_isFab=!1;color;get disableRipple(){return this._disableRipple}set disableRipple(e){this._disableRipple=e,this._updateRippleDisabled()}_disableRipple=!1;get disabled(){return this._disabled}set disabled(e){this._disabled=e,this._updateRippleDisabled()}_disabled=!1;ariaDisabled;disabledInteractive;tabIndex;set _tabindex(e){this.tabIndex=e}constructor(){s(Ce).load(dn);let e=this._elementRef.nativeElement;this._isAnchor=e.tagName==="A",this.disabledInteractive=this._config?.disabledInteractive??!1,this.color=this._config?.color??null,this._rippleLoader?.configureRipple(e,{className:"mat-mdc-button-ripple"})}ngAfterViewInit(){this._focusMonitor.monitor(this._elementRef,!0),this._isAnchor&&this._setupAsAnchor()}ngOnDestroy(){this._cleanupClick?.(),this._focusMonitor.stopMonitoring(this._elementRef),this._rippleLoader?.destroyRipple(this._elementRef.nativeElement)}focus(e="program",t){e?this._focusMonitor.focusVia(this._elementRef.nativeElement,e,t):this._elementRef.nativeElement.focus(t)}_getAriaDisabled(){return this.ariaDisabled!=null?this.ariaDisabled:this._isAnchor?this.disabled||null:this.disabled&&this.disabledInteractive?!0:null}_getDisabledAttribute(){return this.disabledInteractive||!this.disabled?null:!0}_updateRippleDisabled(){this._rippleLoader?.setDisabled(this._elementRef.nativeElement,this.disableRipple||this.disabled)}_getTabIndex(){return this._isAnchor?this.disabled&&!this.disabledInteractive?-1:this.tabIndex:this.tabIndex}_setupAsAnchor(){this._cleanupClick=this._ngZone.runOutsideAngular(()=>this._renderer.listen(this._elementRef.nativeElement,"click",e=>{this.disabled&&(e.preventDefault(),e.stopImmediatePropagation())}))}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,hostAttrs:[1,"mat-mdc-button-base"],hostVars:13,hostBindings:function(t,n){t&2&&(w("disabled",n._getDisabledAttribute())("aria-disabled",n._getAriaDisabled())("tabindex",n._getTabIndex()),We(n.color?"mat-"+n.color:""),D("mat-mdc-button-disabled",n.disabled)("mat-mdc-button-disabled-interactive",n.disabledInteractive)("mat-unthemed",!n.color)("_mat-animation-noopable",n._animationsDisabled))},inputs:{color:"color",disableRipple:[2,"disableRipple","disableRipple",P],disabled:[2,"disabled","disabled",P],ariaDisabled:[2,"aria-disabled","ariaDisabled",P],disabledInteractive:[2,"disabledInteractive","disabledInteractive",P],tabIndex:[2,"tabIndex","tabIndex",na],_tabindex:[2,"tabindex","_tabindex",na]}})}return i})(),ut=(()=>{class i extends Wn{constructor(){super(),this._rippleLoader.configureRipple(this._elementRef.nativeElement,{centered:!0})}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["button","mat-icon-button",""],["a","mat-icon-button",""],["button","matIconButton",""],["a","matIconButton",""]],hostAttrs:[1,"mdc-icon-button","mat-mdc-icon-button"],exportAs:["matButton","matAnchor"],features:[ce],attrs:uo,ngContentSelectors:ho,decls:4,vars:0,consts:[[1,"mat-mdc-button-persistent-ripple","mdc-icon-button__ripple"],[1,"mat-focus-indicator"],[1,"mat-mdc-button-touch-target"]],template:function(t,n){t&1&&(ie(),xe(0,"span",0),z(1),xe(2,"span",1)(3,"span",2))},styles:[`.mat-mdc-icon-button {
  -webkit-user-select: none;
  user-select: none;
  display: inline-block;
  position: relative;
  box-sizing: border-box;
  border: none;
  outline: none;
  background-color: transparent;
  fill: currentColor;
  text-decoration: none;
  cursor: pointer;
  z-index: 0;
  overflow: visible;
  border-radius: var(--mat-icon-button-container-shape, var(--mat-sys-corner-full, 50%));
  flex-shrink: 0;
  text-align: center;
  width: var(--mat-icon-button-state-layer-size, 40px);
  height: var(--mat-icon-button-state-layer-size, 40px);
  padding: calc(calc(var(--mat-icon-button-state-layer-size, 40px) - var(--mat-icon-button-icon-size, 24px)) / 2);
  font-size: var(--mat-icon-button-icon-size, 24px);
  color: var(--mat-icon-button-icon-color, var(--mat-sys-on-surface-variant));
  -webkit-tap-highlight-color: transparent;
}
.mat-mdc-icon-button .mat-mdc-button-ripple,
.mat-mdc-icon-button .mat-mdc-button-persistent-ripple,
.mat-mdc-icon-button .mat-mdc-button-persistent-ripple::before {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
}
.mat-mdc-icon-button .mat-mdc-button-ripple {
  overflow: hidden;
}
.mat-mdc-icon-button .mat-mdc-button-persistent-ripple::before {
  content: "";
  opacity: 0;
}
.mat-mdc-icon-button .mdc-button__label,
.mat-mdc-icon-button .mat-icon {
  z-index: 1;
  position: relative;
}
.mat-mdc-icon-button .mat-focus-indicator {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  border-radius: inherit;
}
.mat-mdc-icon-button:focus-visible > .mat-focus-indicator::before {
  content: "";
  border-radius: inherit;
}
.mat-mdc-icon-button .mat-ripple-element {
  background-color: var(--mat-icon-button-ripple-color, color-mix(in srgb, var(--mat-sys-on-surface-variant) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-icon-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-icon-button-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-icon-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-icon-button-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-icon-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-icon-button-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-icon-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-icon-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-icon-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-icon-button-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-icon-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-icon-button-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-icon-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-icon-button-touch-target-size, 48px);
  display: var(--mat-icon-button-touch-target-display, block);
  left: 50%;
  width: var(--mat-icon-button-touch-target-size, 48px);
  transform: translate(-50%, -50%);
}
.mat-mdc-icon-button._mat-animation-noopable {
  transition: none !important;
  animation: none !important;
}
.mat-mdc-icon-button[disabled], .mat-mdc-icon-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-icon-button-disabled-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-mdc-icon-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-mdc-icon-button img,
.mat-mdc-icon-button svg {
  width: var(--mat-icon-button-icon-size, 24px);
  height: var(--mat-icon-button-icon-size, 24px);
  vertical-align: baseline;
}
.mat-mdc-icon-button .mat-mdc-button-persistent-ripple {
  border-radius: var(--mat-icon-button-container-shape, var(--mat-sys-corner-full, 50%));
}
.mat-mdc-icon-button[hidden] {
  display: none;
}
.mat-mdc-icon-button.mat-unthemed:not(.mdc-ripple-upgraded):focus::before, .mat-mdc-icon-button.mat-primary:not(.mdc-ripple-upgraded):focus::before, .mat-mdc-icon-button.mat-accent:not(.mdc-ripple-upgraded):focus::before, .mat-mdc-icon-button.mat-warn:not(.mdc-ripple-upgraded):focus::before {
  background: transparent;
  opacity: 1;
}
`,`@media (forced-colors: active) {
  .mat-mdc-button:not(.mdc-button--outlined),
  .mat-mdc-unelevated-button:not(.mdc-button--outlined),
  .mat-mdc-raised-button:not(.mdc-button--outlined),
  .mat-mdc-outlined-button:not(.mdc-button--outlined),
  .mat-mdc-button-base.mat-tonal-button,
  .mat-mdc-icon-button.mat-mdc-icon-button,
  .mat-mdc-outlined-button .mdc-button__ripple {
    outline: solid 1px;
  }
}
`],encapsulation:2,changeDetection:0})}return i})();var _o=["matButton",""],go=[[["",8,"material-icons",3,"iconPositionEnd",""],["mat-icon",3,"iconPositionEnd",""],["","matButtonIcon","",3,"iconPositionEnd",""]],"*",[["","iconPositionEnd","",8,"material-icons"],["mat-icon","iconPositionEnd",""],["","matButtonIcon","","iconPositionEnd",""]]],bo=[".material-icons:not([iconPositionEnd]), mat-icon:not([iconPositionEnd]), [matButtonIcon]:not([iconPositionEnd])","*",".material-icons[iconPositionEnd], mat-icon[iconPositionEnd], [matButtonIcon][iconPositionEnd]"];var ia=new Map([["text",["mat-mdc-button"]],["filled",["mdc-button--unelevated","mat-mdc-unelevated-button"]],["elevated",["mdc-button--raised","mat-mdc-raised-button"]],["outlined",["mdc-button--outlined","mat-mdc-outlined-button"]],["tonal",["mat-tonal-button"]]]),qn=(()=>{class i extends Wn{get appearance(){return this._appearance}set appearance(e){this.setAppearance(e||this._config?.defaultAppearance||"text")}_appearance=null;constructor(){super();let e=vo(this._elementRef.nativeElement);e&&this.setAppearance(e)}setAppearance(e){if(e===this._appearance)return;let t=this._elementRef.nativeElement.classList,n=this._appearance?ia.get(this._appearance):null,o=ia.get(e);n&&t.remove(...n),t.add(...o),this._appearance=e}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["button","matButton",""],["a","matButton",""],["button","mat-button",""],["button","mat-raised-button",""],["button","mat-flat-button",""],["button","mat-stroked-button",""],["a","mat-button",""],["a","mat-raised-button",""],["a","mat-flat-button",""],["a","mat-stroked-button",""]],hostAttrs:[1,"mdc-button"],inputs:{appearance:[0,"matButton","appearance"]},exportAs:["matButton","matAnchor"],features:[ce],attrs:_o,ngContentSelectors:bo,decls:7,vars:4,consts:[[1,"mat-mdc-button-persistent-ripple"],[1,"mdc-button__label"],[1,"mat-focus-indicator"],[1,"mat-mdc-button-touch-target"]],template:function(t,n){t&1&&(ie(go),xe(0,"span",0),z(1),G(2,"span",1),z(3,1),J(),z(4,2),xe(5,"span",2)(6,"span",3)),t&2&&D("mdc-button__ripple",!n._isFab)("mdc-fab__ripple",n._isFab)},styles:[`.mat-mdc-button-base {
  text-decoration: none;
}
.mat-mdc-button-base .mat-icon {
  min-height: fit-content;
  flex-shrink: 0;
}
@media (hover: none) {
  .mat-mdc-button-base:hover > span.mat-mdc-button-persistent-ripple::before {
    opacity: 0;
  }
}

.mdc-button {
  -webkit-user-select: none;
  user-select: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 64px;
  border: none;
  outline: none;
  line-height: inherit;
  -webkit-appearance: none;
  overflow: visible;
  vertical-align: middle;
  background: transparent;
  padding: 0 8px;
}
.mdc-button::-moz-focus-inner {
  padding: 0;
  border: 0;
}
.mdc-button:active {
  outline: none;
}
.mdc-button:hover {
  cursor: pointer;
}
.mdc-button:disabled {
  cursor: default;
  pointer-events: none;
}
.mdc-button[hidden] {
  display: none;
}
.mdc-button .mdc-button__label {
  position: relative;
}

.mat-mdc-button {
  padding: 0 var(--mat-button-text-horizontal-padding, 12px);
  height: var(--mat-button-text-container-height, 40px);
  font-family: var(--mat-button-text-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-text-label-text-size, var(--mat-sys-label-large-size));
  letter-spacing: var(--mat-button-text-label-text-tracking, var(--mat-sys-label-large-tracking));
  text-transform: var(--mat-button-text-label-text-transform);
  font-weight: var(--mat-button-text-label-text-weight, var(--mat-sys-label-large-weight));
}
.mat-mdc-button, .mat-mdc-button .mdc-button__ripple {
  border-radius: var(--mat-button-text-container-shape, var(--mat-sys-corner-full));
}
.mat-mdc-button:not(:disabled) {
  color: var(--mat-button-text-label-text-color, var(--mat-sys-primary));
}
.mat-mdc-button[disabled], .mat-mdc-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-button-text-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-mdc-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-mdc-button:has(.material-icons, mat-icon, [matButtonIcon]) {
  padding: 0 var(--mat-button-text-with-icon-horizontal-padding, 16px);
}
.mat-mdc-button > .mat-icon {
  margin-right: var(--mat-button-text-icon-spacing, 8px);
  margin-left: var(--mat-button-text-icon-offset, -4px);
}
[dir=rtl] .mat-mdc-button > .mat-icon {
  margin-right: var(--mat-button-text-icon-offset, -4px);
  margin-left: var(--mat-button-text-icon-spacing, 8px);
}
.mat-mdc-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-text-icon-offset, -4px);
  margin-left: var(--mat-button-text-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-text-icon-spacing, 8px);
  margin-left: var(--mat-button-text-icon-offset, -4px);
}
.mat-mdc-button .mat-ripple-element {
  background-color: var(--mat-button-text-ripple-color, color-mix(in srgb, var(--mat-sys-primary) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-text-state-layer-color, var(--mat-sys-primary));
}
.mat-mdc-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-text-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-text-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-text-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-text-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-button-text-touch-target-size, 48px);
  display: var(--mat-button-text-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}

.mat-mdc-unelevated-button {
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
  height: var(--mat-button-filled-container-height, 40px);
  font-family: var(--mat-button-filled-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-filled-label-text-size, var(--mat-sys-label-large-size));
  letter-spacing: var(--mat-button-filled-label-text-tracking, var(--mat-sys-label-large-tracking));
  text-transform: var(--mat-button-filled-label-text-transform);
  font-weight: var(--mat-button-filled-label-text-weight, var(--mat-sys-label-large-weight));
  padding: 0 var(--mat-button-filled-horizontal-padding, 24px);
}
.mat-mdc-unelevated-button > .mat-icon {
  margin-right: var(--mat-button-filled-icon-spacing, 8px);
  margin-left: var(--mat-button-filled-icon-offset, -8px);
}
[dir=rtl] .mat-mdc-unelevated-button > .mat-icon {
  margin-right: var(--mat-button-filled-icon-offset, -8px);
  margin-left: var(--mat-button-filled-icon-spacing, 8px);
}
.mat-mdc-unelevated-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-filled-icon-offset, -8px);
  margin-left: var(--mat-button-filled-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-unelevated-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-filled-icon-spacing, 8px);
  margin-left: var(--mat-button-filled-icon-offset, -8px);
}
.mat-mdc-unelevated-button .mat-ripple-element {
  background-color: var(--mat-button-filled-ripple-color, color-mix(in srgb, var(--mat-sys-on-primary) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-filled-state-layer-color, var(--mat-sys-on-primary));
}
.mat-mdc-unelevated-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-filled-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-unelevated-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-filled-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-unelevated-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-unelevated-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-unelevated-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-filled-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-unelevated-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-filled-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-unelevated-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-button-filled-touch-target-size, 48px);
  display: var(--mat-button-filled-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}
.mat-mdc-unelevated-button:not(:disabled) {
  color: var(--mat-button-filled-label-text-color, var(--mat-sys-on-primary));
  background-color: var(--mat-button-filled-container-color, var(--mat-sys-primary));
}
.mat-mdc-unelevated-button, .mat-mdc-unelevated-button .mdc-button__ripple {
  border-radius: var(--mat-button-filled-container-shape, var(--mat-sys-corner-full));
}
.mat-mdc-unelevated-button[disabled], .mat-mdc-unelevated-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-button-filled-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-button-filled-disabled-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-unelevated-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-mdc-raised-button {
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--mat-button-protected-container-elevation-shadow, var(--mat-sys-level1));
  height: var(--mat-button-protected-container-height, 40px);
  font-family: var(--mat-button-protected-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-protected-label-text-size, var(--mat-sys-label-large-size));
  letter-spacing: var(--mat-button-protected-label-text-tracking, var(--mat-sys-label-large-tracking));
  text-transform: var(--mat-button-protected-label-text-transform);
  font-weight: var(--mat-button-protected-label-text-weight, var(--mat-sys-label-large-weight));
  padding: 0 var(--mat-button-protected-horizontal-padding, 24px);
}
.mat-mdc-raised-button > .mat-icon {
  margin-right: var(--mat-button-protected-icon-spacing, 8px);
  margin-left: var(--mat-button-protected-icon-offset, -8px);
}
[dir=rtl] .mat-mdc-raised-button > .mat-icon {
  margin-right: var(--mat-button-protected-icon-offset, -8px);
  margin-left: var(--mat-button-protected-icon-spacing, 8px);
}
.mat-mdc-raised-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-protected-icon-offset, -8px);
  margin-left: var(--mat-button-protected-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-raised-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-protected-icon-spacing, 8px);
  margin-left: var(--mat-button-protected-icon-offset, -8px);
}
.mat-mdc-raised-button .mat-ripple-element {
  background-color: var(--mat-button-protected-ripple-color, color-mix(in srgb, var(--mat-sys-primary) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-protected-state-layer-color, var(--mat-sys-primary));
}
.mat-mdc-raised-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-protected-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-raised-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-protected-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-raised-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-raised-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-raised-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-protected-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-raised-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-protected-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-raised-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-button-protected-touch-target-size, 48px);
  display: var(--mat-button-protected-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}
.mat-mdc-raised-button:not(:disabled) {
  color: var(--mat-button-protected-label-text-color, var(--mat-sys-primary));
  background-color: var(--mat-button-protected-container-color, var(--mat-sys-surface));
}
.mat-mdc-raised-button, .mat-mdc-raised-button .mdc-button__ripple {
  border-radius: var(--mat-button-protected-container-shape, var(--mat-sys-corner-full));
}
@media (hover: hover) {
  .mat-mdc-raised-button:hover {
    box-shadow: var(--mat-button-protected-hover-container-elevation-shadow, var(--mat-sys-level2));
  }
}
.mat-mdc-raised-button:focus {
  box-shadow: var(--mat-button-protected-focus-container-elevation-shadow, var(--mat-sys-level1));
}
.mat-mdc-raised-button:active, .mat-mdc-raised-button:focus:active {
  box-shadow: var(--mat-button-protected-pressed-container-elevation-shadow, var(--mat-sys-level1));
}
.mat-mdc-raised-button[disabled], .mat-mdc-raised-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-button-protected-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-button-protected-disabled-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-raised-button[disabled].mat-mdc-button-disabled, .mat-mdc-raised-button.mat-mdc-button-disabled.mat-mdc-button-disabled {
  box-shadow: var(--mat-button-protected-disabled-container-elevation-shadow, var(--mat-sys-level0));
}
.mat-mdc-raised-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-mdc-outlined-button {
  border-style: solid;
  transition: border 280ms cubic-bezier(0.4, 0, 0.2, 1);
  height: var(--mat-button-outlined-container-height, 40px);
  font-family: var(--mat-button-outlined-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-outlined-label-text-size, var(--mat-sys-label-large-size));
  letter-spacing: var(--mat-button-outlined-label-text-tracking, var(--mat-sys-label-large-tracking));
  text-transform: var(--mat-button-outlined-label-text-transform);
  font-weight: var(--mat-button-outlined-label-text-weight, var(--mat-sys-label-large-weight));
  border-radius: var(--mat-button-outlined-container-shape, var(--mat-sys-corner-full));
  border-width: var(--mat-button-outlined-outline-width, 1px);
  padding: 0 var(--mat-button-outlined-horizontal-padding, 24px);
}
.mat-mdc-outlined-button > .mat-icon {
  margin-right: var(--mat-button-outlined-icon-spacing, 8px);
  margin-left: var(--mat-button-outlined-icon-offset, -8px);
}
[dir=rtl] .mat-mdc-outlined-button > .mat-icon {
  margin-right: var(--mat-button-outlined-icon-offset, -8px);
  margin-left: var(--mat-button-outlined-icon-spacing, 8px);
}
.mat-mdc-outlined-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-outlined-icon-offset, -8px);
  margin-left: var(--mat-button-outlined-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-outlined-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-outlined-icon-spacing, 8px);
  margin-left: var(--mat-button-outlined-icon-offset, -8px);
}
.mat-mdc-outlined-button .mat-ripple-element {
  background-color: var(--mat-button-outlined-ripple-color, color-mix(in srgb, var(--mat-sys-primary) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-outlined-state-layer-color, var(--mat-sys-primary));
}
.mat-mdc-outlined-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-outlined-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-mdc-outlined-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-outlined-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-outlined-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-outlined-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-outlined-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-outlined-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-mdc-outlined-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-outlined-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-outlined-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-button-outlined-touch-target-size, 48px);
  display: var(--mat-button-outlined-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}
.mat-mdc-outlined-button:not(:disabled) {
  color: var(--mat-button-outlined-label-text-color, var(--mat-sys-primary));
  border-color: var(--mat-button-outlined-outline-color, var(--mat-sys-outline));
}
.mat-mdc-outlined-button[disabled], .mat-mdc-outlined-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-button-outlined-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  border-color: var(--mat-button-outlined-disabled-outline-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-outlined-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-tonal-button {
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
  height: var(--mat-button-tonal-container-height, 40px);
  font-family: var(--mat-button-tonal-label-text-font, var(--mat-sys-label-large-font));
  font-size: var(--mat-button-tonal-label-text-size, var(--mat-sys-label-large-size));
  letter-spacing: var(--mat-button-tonal-label-text-tracking, var(--mat-sys-label-large-tracking));
  text-transform: var(--mat-button-tonal-label-text-transform);
  font-weight: var(--mat-button-tonal-label-text-weight, var(--mat-sys-label-large-weight));
  padding: 0 var(--mat-button-tonal-horizontal-padding, 24px);
}
.mat-tonal-button:not(:disabled) {
  color: var(--mat-button-tonal-label-text-color, var(--mat-sys-on-secondary-container));
  background-color: var(--mat-button-tonal-container-color, var(--mat-sys-secondary-container));
}
.mat-tonal-button, .mat-tonal-button .mdc-button__ripple {
  border-radius: var(--mat-button-tonal-container-shape, var(--mat-sys-corner-full));
}
.mat-tonal-button[disabled], .mat-tonal-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--mat-button-tonal-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
  background-color: var(--mat-button-tonal-disabled-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mat-tonal-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-tonal-button > .mat-icon {
  margin-right: var(--mat-button-tonal-icon-spacing, 8px);
  margin-left: var(--mat-button-tonal-icon-offset, -8px);
}
[dir=rtl] .mat-tonal-button > .mat-icon {
  margin-right: var(--mat-button-tonal-icon-offset, -8px);
  margin-left: var(--mat-button-tonal-icon-spacing, 8px);
}
.mat-tonal-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-tonal-icon-offset, -8px);
  margin-left: var(--mat-button-tonal-icon-spacing, 8px);
}
[dir=rtl] .mat-tonal-button .mdc-button__label + .mat-icon {
  margin-right: var(--mat-button-tonal-icon-spacing, 8px);
  margin-left: var(--mat-button-tonal-icon-offset, -8px);
}
.mat-tonal-button .mat-ripple-element {
  background-color: var(--mat-button-tonal-ripple-color, color-mix(in srgb, var(--mat-sys-on-secondary-container) calc(var(--mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-tonal-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-tonal-state-layer-color, var(--mat-sys-on-secondary-container));
}
.mat-tonal-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--mat-button-tonal-disabled-state-layer-color, var(--mat-sys-on-surface-variant));
}
.mat-tonal-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-tonal-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-tonal-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-tonal-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-tonal-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-tonal-focus-state-layer-opacity, var(--mat-sys-focus-state-layer-opacity));
}
.mat-tonal-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--mat-button-tonal-pressed-state-layer-opacity, var(--mat-sys-pressed-state-layer-opacity));
}
.mat-tonal-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--mat-button-tonal-touch-target-size, 48px);
  display: var(--mat-button-tonal-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}

.mat-mdc-button,
.mat-mdc-unelevated-button,
.mat-mdc-raised-button,
.mat-mdc-outlined-button,
.mat-tonal-button {
  -webkit-tap-highlight-color: transparent;
}
.mat-mdc-button .mat-mdc-button-ripple,
.mat-mdc-button .mat-mdc-button-persistent-ripple,
.mat-mdc-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-unelevated-button .mat-mdc-button-ripple,
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple,
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-raised-button .mat-mdc-button-ripple,
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple,
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-outlined-button .mat-mdc-button-ripple,
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple,
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple::before,
.mat-tonal-button .mat-mdc-button-ripple,
.mat-tonal-button .mat-mdc-button-persistent-ripple,
.mat-tonal-button .mat-mdc-button-persistent-ripple::before {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
}
.mat-mdc-button .mat-mdc-button-ripple,
.mat-mdc-unelevated-button .mat-mdc-button-ripple,
.mat-mdc-raised-button .mat-mdc-button-ripple,
.mat-mdc-outlined-button .mat-mdc-button-ripple,
.mat-tonal-button .mat-mdc-button-ripple {
  overflow: hidden;
}
.mat-mdc-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple::before,
.mat-tonal-button .mat-mdc-button-persistent-ripple::before {
  content: "";
  opacity: 0;
}
.mat-mdc-button .mdc-button__label,
.mat-mdc-button .mat-icon,
.mat-mdc-unelevated-button .mdc-button__label,
.mat-mdc-unelevated-button .mat-icon,
.mat-mdc-raised-button .mdc-button__label,
.mat-mdc-raised-button .mat-icon,
.mat-mdc-outlined-button .mdc-button__label,
.mat-mdc-outlined-button .mat-icon,
.mat-tonal-button .mdc-button__label,
.mat-tonal-button .mat-icon {
  z-index: 1;
  position: relative;
}
.mat-mdc-button .mat-focus-indicator,
.mat-mdc-unelevated-button .mat-focus-indicator,
.mat-mdc-raised-button .mat-focus-indicator,
.mat-mdc-outlined-button .mat-focus-indicator,
.mat-tonal-button .mat-focus-indicator {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  border-radius: inherit;
}
.mat-mdc-button:focus-visible > .mat-focus-indicator::before,
.mat-mdc-unelevated-button:focus-visible > .mat-focus-indicator::before,
.mat-mdc-raised-button:focus-visible > .mat-focus-indicator::before,
.mat-mdc-outlined-button:focus-visible > .mat-focus-indicator::before,
.mat-tonal-button:focus-visible > .mat-focus-indicator::before {
  content: "";
  border-radius: inherit;
}
.mat-mdc-button._mat-animation-noopable,
.mat-mdc-unelevated-button._mat-animation-noopable,
.mat-mdc-raised-button._mat-animation-noopable,
.mat-mdc-outlined-button._mat-animation-noopable,
.mat-tonal-button._mat-animation-noopable {
  transition: none !important;
  animation: none !important;
}
.mat-mdc-button > .mat-icon,
.mat-mdc-unelevated-button > .mat-icon,
.mat-mdc-raised-button > .mat-icon,
.mat-mdc-outlined-button > .mat-icon,
.mat-tonal-button > .mat-icon {
  display: inline-block;
  position: relative;
  vertical-align: top;
  font-size: 1.125rem;
  height: 1.125rem;
  width: 1.125rem;
}

.mat-mdc-outlined-button .mat-mdc-button-ripple,
.mat-mdc-outlined-button .mdc-button__ripple {
  top: -1px;
  left: -1px;
  bottom: -1px;
  right: -1px;
}

.mat-mdc-unelevated-button .mat-focus-indicator::before,
.mat-tonal-button .mat-focus-indicator::before,
.mat-mdc-raised-button .mat-focus-indicator::before {
  margin: calc(calc(var(--mat-focus-indicator-border-width, 3px) + 2px) * -1);
}

.mat-mdc-outlined-button .mat-focus-indicator::before {
  margin: calc(calc(var(--mat-focus-indicator-border-width, 3px) + 3px) * -1);
}
`,`@media (forced-colors: active) {
  .mat-mdc-button:not(.mdc-button--outlined),
  .mat-mdc-unelevated-button:not(.mdc-button--outlined),
  .mat-mdc-raised-button:not(.mdc-button--outlined),
  .mat-mdc-outlined-button:not(.mdc-button--outlined),
  .mat-mdc-button-base.mat-tonal-button,
  .mat-mdc-icon-button.mat-mdc-icon-button,
  .mat-mdc-outlined-button .mdc-button__ripple {
    outline: solid 1px;
  }
}
`],encapsulation:2,changeDetection:0})}return i})();function vo(i){return i.hasAttribute("mat-raised-button")?"elevated":i.hasAttribute("mat-stroked-button")?"outlined":i.hasAttribute("mat-flat-button")?"filled":i.hasAttribute("mat-button")?"text":null}var aa=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=$({type:i});static \u0275inj=q({imports:[Ji,ge]})}return i})();var $n=class{_box;_destroyed=new O;_resizeSubject=new O;_resizeObserver;_elementObservables=new Map;constructor(a){this._box=a,typeof ResizeObserver<"u"&&(this._resizeObserver=new ResizeObserver(e=>this._resizeSubject.next(e)))}observe(a){return this._elementObservables.has(a)||this._elementObservables.set(a,new Lt(e=>{let t=this._resizeSubject.subscribe(e);return this._resizeObserver?.observe(a,{box:this._box}),()=>{this._resizeObserver?.unobserve(a),t.unsubscribe(),this._elementObservables.delete(a)}}).pipe(Ae(e=>e.some(t=>t.target===a)),Vn({bufferSize:1,refCount:!0}),he(this._destroyed))),this._elementObservables.get(a)}destroy(){this._destroyed.next(),this._destroyed.complete(),this._resizeSubject.complete(),this._elementObservables.clear()}},oa=(()=>{class i{_cleanupErrorListener;_observers=new Map;_ngZone=s(V);constructor(){typeof ResizeObserver<"u"}ngOnDestroy(){for(let[,e]of this._observers)e.destroy();this._observers.clear(),this._cleanupErrorListener?.()}observe(e,t){let n=t?.box||"content-box";return this._observers.has(n)||this._observers.set(n,new $n(n)),this._observers.get(n).observe(e)}static \u0275fac=function(t){return new(t||i)};static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})();var yo=["notch"],xo=["matFormFieldNotchedOutline",""],Co=["*"],ra=["iconPrefixContainer"],sa=["textPrefixContainer"],la=["iconSuffixContainer"],da=["textSuffixContainer"],wo=["textField"],Do=["*",[["mat-label"]],[["","matPrefix",""],["","matIconPrefix",""]],[["","matTextPrefix",""]],[["","matTextSuffix",""]],[["","matSuffix",""],["","matIconSuffix",""]],[["mat-error"],["","matError",""]],[["mat-hint",3,"align","end"]],[["mat-hint","align","end"]]],ko=["*","mat-label","[matPrefix], [matIconPrefix]","[matTextPrefix]","[matTextSuffix]","[matSuffix], [matIconSuffix]","mat-error, [matError]","mat-hint:not([align='end'])","mat-hint[align='end']"];function Mo(i,a){i&1&&ne(0,"span",21)}function So(i,a){if(i&1&&(c(0,"label",20),z(1,1),v(2,Mo,1,0,"span",21),p()),i&2){let e=d(2);b("floating",e._shouldLabelFloat())("monitorResize",e._hasOutline())("id",e._labelId),w("for",e._control.disableAutomaticLabeling?null:e._control.id),l(2),y(!e.hideRequiredMarker&&e._control.required?2:-1)}}function Eo(i,a){if(i&1&&v(0,So,3,5,"label",20),i&2){let e=d();y(e._hasFloatingLabel()?0:-1)}}function Ao(i,a){i&1&&ne(0,"div",7)}function Po(i,a){}function To(i,a){if(i&1&&Ve(0,Po,0,0,"ng-template",13),i&2){d(2);let e=W(1);b("ngTemplateOutlet",e)}}function Oo(i,a){if(i&1&&(c(0,"div",9),v(1,To,1,1,null,13),p()),i&2){let e=d();b("matFormFieldNotchedOutlineOpen",e._shouldLabelFloat()),l(),y(e._forceDisplayInfixLabel()?-1:1)}}function Io(i,a){i&1&&(c(0,"div",10,2),z(2,2),p())}function Ro(i,a){i&1&&(c(0,"div",11,3),z(2,3),p())}function Vo(i,a){}function Fo(i,a){if(i&1&&Ve(0,Vo,0,0,"ng-template",13),i&2){d();let e=W(1);b("ngTemplateOutlet",e)}}function Lo(i,a){i&1&&(c(0,"div",14,4),z(2,4),p())}function Bo(i,a){i&1&&(c(0,"div",15,5),z(2,5),p())}function zo(i,a){i&1&&ne(0,"div",16)}function No(i,a){i&1&&(c(0,"div",18),z(1,6),p())}function Ho(i,a){if(i&1&&(c(0,"mat-hint",22),_(1),p()),i&2){let e=d(2);b("id",e._hintLabelId),l(),k(e.hintLabel)}}function Yo(i,a){if(i&1&&(c(0,"div",19),v(1,Ho,2,2,"mat-hint",22),z(2,7),ne(3,"div",23),z(4,8),p()),i&2){let e=d();l(),y(e.hintLabel?1:-1)}}var Xn=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["mat-label"]]})}return i})(),jo=new B("MatError");var Un=(()=>{class i{align="start";id=s(me).getId("mat-mdc-hint-");static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["mat-hint"]],hostAttrs:[1,"mat-mdc-form-field-hint","mat-mdc-form-field-bottom-align"],hostVars:4,hostBindings:function(t,n){t&2&&(se("id",n.id),w("align",null),D("mat-mdc-form-field-hint-end",n.align==="end"))},inputs:{align:"align",id:"id"}})}return i})(),Wo=new B("MatPrefix");var _a=new B("MatSuffix"),Kn=(()=>{class i{set _isTextSelector(e){this._isText=!0}_isText=!1;static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["","matSuffix",""],["","matIconSuffix",""],["","matTextSuffix",""]],inputs:{_isTextSelector:[0,"matTextSuffix","_isTextSelector"]},features:[X([{provide:_a,useExisting:i}])]})}return i})(),ga=new B("FloatingLabelParent"),ca=(()=>{class i{_elementRef=s(A);get floating(){return this._floating}set floating(e){this._floating=e,this.monitorResize&&this._handleResize()}_floating=!1;get monitorResize(){return this._monitorResize}set monitorResize(e){this._monitorResize=e,this._monitorResize?this._subscribeToResize():this._resizeSubscription.unsubscribe()}_monitorResize=!1;_resizeObserver=s(oa);_ngZone=s(V);_parent=s(ga);_resizeSubscription=new N;constructor(){}ngOnDestroy(){this._resizeSubscription.unsubscribe()}getWidth(){return qo(this._elementRef.nativeElement)}get element(){return this._elementRef.nativeElement}_handleResize(){setTimeout(()=>this._parent._handleLabelResized())}_subscribeToResize(){this._resizeSubscription.unsubscribe(),this._ngZone.runOutsideAngular(()=>{this._resizeSubscription=this._resizeObserver.observe(this._elementRef.nativeElement,{box:"border-box"}).subscribe(()=>this._handleResize())})}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["label","matFormFieldFloatingLabel",""]],hostAttrs:[1,"mdc-floating-label","mat-mdc-floating-label"],hostVars:2,hostBindings:function(t,n){t&2&&D("mdc-floating-label--float-above",n.floating)},inputs:{floating:"floating",monitorResize:"monitorResize"}})}return i})();function qo(i){let a=i;if(a.offsetParent!==null)return a.scrollWidth;let e=a.cloneNode(!0);e.style.setProperty("position","absolute"),e.style.setProperty("transform","translate(-9999px, -9999px)"),document.documentElement.appendChild(e);let t=e.scrollWidth;return e.remove(),t}var pa="mdc-line-ripple--active",mn="mdc-line-ripple--deactivating",ma=(()=>{class i{_elementRef=s(A);_cleanupTransitionEnd;constructor(){let e=s(V),t=s(Q);e.runOutsideAngular(()=>{this._cleanupTransitionEnd=t.listen(this._elementRef.nativeElement,"transitionend",this._handleTransitionEnd)})}activate(){let e=this._elementRef.nativeElement.classList;e.remove(mn),e.add(pa)}deactivate(){this._elementRef.nativeElement.classList.add(mn)}_handleTransitionEnd=e=>{let t=this._elementRef.nativeElement.classList,n=t.contains(mn);e.propertyName==="opacity"&&n&&t.remove(pa,mn)};ngOnDestroy(){this._cleanupTransitionEnd()}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["div","matFormFieldLineRipple",""]],hostAttrs:[1,"mdc-line-ripple"]})}return i})(),ua=(()=>{class i{_elementRef=s(A);_ngZone=s(V);open=!1;_notch;ngAfterViewInit(){let e=this._elementRef.nativeElement,t=e.querySelector(".mdc-floating-label");t?(e.classList.add("mdc-notched-outline--upgraded"),typeof requestAnimationFrame=="function"&&(t.style.transitionDuration="0s",this._ngZone.runOutsideAngular(()=>{requestAnimationFrame(()=>t.style.transitionDuration="")}))):e.classList.add("mdc-notched-outline--no-label")}_setNotchWidth(e){let t=this._notch.nativeElement;!this.open||!e?t.style.width="":t.style.width=`calc(${e}px * var(--mat-mdc-form-field-floating-label-scale, 0.75) + 9px)`}_setMaxWidth(e){this._notch.nativeElement.style.setProperty("--mat-form-field-notch-max-width",`calc(100% - ${e}px)`)}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["div","matFormFieldNotchedOutline",""]],viewQuery:function(t,n){if(t&1&&_e(yo,5),t&2){let o;F(o=L())&&(n._notch=o.first)}},hostAttrs:[1,"mdc-notched-outline"],hostVars:2,hostBindings:function(t,n){t&2&&D("mdc-notched-outline--notched",n.open)},inputs:{open:[0,"matFormFieldNotchedOutlineOpen","open"]},attrs:xo,ngContentSelectors:Co,decls:5,vars:0,consts:[["notch",""],[1,"mat-mdc-notch-piece","mdc-notched-outline__leading"],[1,"mat-mdc-notch-piece","mdc-notched-outline__notch"],[1,"mat-mdc-notch-piece","mdc-notched-outline__trailing"]],template:function(t,n){t&1&&(ie(),xe(0,"div",1),G(1,"div",2,0),z(3),J(),xe(4,"div",3))},encapsulation:2,changeDetection:0})}return i})(),Tt=(()=>{class i{value=null;stateChanges;id;placeholder;ngControl=null;focused=!1;empty=!1;shouldLabelFloat=!1;required=!1;disabled=!1;errorState=!1;controlType;autofilled;userAriaDescribedBy;disableAutomaticLabeling;describedByIds;static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i})}return i})();var $e=new B("MatFormField"),$o=new B("MAT_FORM_FIELD_DEFAULT_OPTIONS"),ha="fill",Xo="auto",fa="fixed",Uo="translateY(-50%)",un=(()=>{class i{_elementRef=s(A);_changeDetectorRef=s(ee);_platform=s(te);_idGenerator=s(me);_ngZone=s(V);_defaults=s($o,{optional:!0});_currentDirection;_textField;_iconPrefixContainer;_textPrefixContainer;_iconSuffixContainer;_textSuffixContainer;_floatingLabel;_notchedOutline;_lineRipple;_iconPrefixContainerSignal=it("iconPrefixContainer");_textPrefixContainerSignal=it("textPrefixContainer");_iconSuffixContainerSignal=it("iconSuffixContainer");_textSuffixContainerSignal=it("textSuffixContainer");_prefixSuffixContainers=Ee(()=>[this._iconPrefixContainerSignal(),this._textPrefixContainerSignal(),this._iconSuffixContainerSignal(),this._textSuffixContainerSignal()].map(e=>e?.nativeElement).filter(e=>e!==void 0));_formFieldControl;_prefixChildren;_suffixChildren;_errorChildren;_hintChildren;_labelChild=Ii(Xn);get hideRequiredMarker(){return this._hideRequiredMarker}set hideRequiredMarker(e){this._hideRequiredMarker=ze(e)}_hideRequiredMarker=!1;color="primary";get floatLabel(){return this._floatLabel||this._defaults?.floatLabel||Xo}set floatLabel(e){e!==this._floatLabel&&(this._floatLabel=e,this._changeDetectorRef.markForCheck())}_floatLabel;get appearance(){return this._appearanceSignal()}set appearance(e){let t=e||this._defaults?.appearance||ha;this._appearanceSignal.set(t)}_appearanceSignal=T(ha);get subscriptSizing(){return this._subscriptSizing||this._defaults?.subscriptSizing||fa}set subscriptSizing(e){this._subscriptSizing=e||this._defaults?.subscriptSizing||fa}_subscriptSizing=null;get hintLabel(){return this._hintLabel}set hintLabel(e){this._hintLabel=e,this._processHints()}_hintLabel="";_hasIconPrefix=!1;_hasTextPrefix=!1;_hasIconSuffix=!1;_hasTextSuffix=!1;_labelId=this._idGenerator.getId("mat-mdc-form-field-label-");_hintLabelId=this._idGenerator.getId("mat-mdc-hint-");_describedByIds;get _control(){return this._explicitFormFieldControl||this._formFieldControl}set _control(e){this._explicitFormFieldControl=e}_destroyed=new O;_isFocused=null;_explicitFormFieldControl;_previousControl=null;_previousControlValidatorFn=null;_stateChanges;_valueChanges;_describedByChanges;_outlineLabelOffsetResizeObserver=null;_animationsDisabled=we();constructor(){let e=this._defaults,t=s(le);e&&(e.appearance&&(this.appearance=e.appearance),this._hideRequiredMarker=!!e?.hideRequiredMarker,e.color&&(this.color=e.color)),Ie(()=>this._currentDirection=t.valueSignal()),this._syncOutlineLabelOffset()}ngAfterViewInit(){this._updateFocusState(),this._animationsDisabled||this._ngZone.runOutsideAngular(()=>{setTimeout(()=>{this._elementRef.nativeElement.classList.add("mat-form-field-animations-enabled")},300)}),this._changeDetectorRef.detectChanges()}ngAfterContentInit(){this._assertFormFieldControl(),this._initializeSubscript(),this._initializePrefixAndSuffix()}ngAfterContentChecked(){this._assertFormFieldControl(),this._control!==this._previousControl&&(this._initializeControl(this._previousControl),this._control.ngControl&&this._control.ngControl.control&&(this._previousControlValidatorFn=this._control.ngControl.control.validator),this._previousControl=this._control),this._control.ngControl&&this._control.ngControl.control&&this._control.ngControl.control.validator!==this._previousControlValidatorFn&&this._changeDetectorRef.markForCheck()}ngOnDestroy(){this._outlineLabelOffsetResizeObserver?.disconnect(),this._stateChanges?.unsubscribe(),this._valueChanges?.unsubscribe(),this._describedByChanges?.unsubscribe(),this._destroyed.next(),this._destroyed.complete()}getLabelId=Ee(()=>this._hasFloatingLabel()?this._labelId:null);getConnectedOverlayOrigin(){return this._textField||this._elementRef}_animateAndLockLabel(){this._hasFloatingLabel()&&(this.floatLabel="always")}_initializeControl(e){let t=this._control,n="mat-mdc-form-field-type-";e&&this._elementRef.nativeElement.classList.remove(n+e.controlType),t.controlType&&this._elementRef.nativeElement.classList.add(n+t.controlType),this._stateChanges?.unsubscribe(),this._stateChanges=t.stateChanges.subscribe(()=>{this._updateFocusState(),this._changeDetectorRef.markForCheck()}),this._describedByChanges?.unsubscribe(),this._describedByChanges=t.stateChanges.pipe(Je([void 0,void 0]),Ci(()=>[t.errorState,t.userAriaDescribedBy]),Rn(),Ae(([[o,r],[m,g]])=>o!==m||r!==g)).subscribe(()=>this._syncDescribedByIds()),this._valueChanges?.unsubscribe(),t.ngControl&&t.ngControl.valueChanges&&(this._valueChanges=t.ngControl.valueChanges.pipe(he(this._destroyed)).subscribe(()=>this._changeDetectorRef.markForCheck()))}_checkPrefixAndSuffixTypes(){this._hasIconPrefix=!!this._prefixChildren.find(e=>!e._isText),this._hasTextPrefix=!!this._prefixChildren.find(e=>e._isText),this._hasIconSuffix=!!this._suffixChildren.find(e=>!e._isText),this._hasTextSuffix=!!this._suffixChildren.find(e=>e._isText)}_initializePrefixAndSuffix(){this._checkPrefixAndSuffixTypes(),Qe(this._prefixChildren.changes,this._suffixChildren.changes).subscribe(()=>{this._checkPrefixAndSuffixTypes(),this._changeDetectorRef.markForCheck()})}_initializeSubscript(){this._hintChildren.changes.subscribe(()=>{this._processHints(),this._changeDetectorRef.markForCheck()}),this._errorChildren.changes.subscribe(()=>{this._syncDescribedByIds(),this._changeDetectorRef.markForCheck()}),this._validateHints(),this._syncDescribedByIds()}_assertFormFieldControl(){this._control}_updateFocusState(){let e=this._control.focused;e&&!this._isFocused?(this._isFocused=!0,this._lineRipple?.activate()):!e&&(this._isFocused||this._isFocused===null)&&(this._isFocused=!1,this._lineRipple?.deactivate()),this._elementRef.nativeElement.classList.toggle("mat-focused",e),this._textField?.nativeElement.classList.toggle("mdc-text-field--focused",e)}_syncOutlineLabelOffset(){Fi({earlyRead:()=>{if(this._appearanceSignal()!=="outline")return this._outlineLabelOffsetResizeObserver?.disconnect(),null;if(globalThis.ResizeObserver){this._outlineLabelOffsetResizeObserver||=new globalThis.ResizeObserver(()=>{this._writeOutlinedLabelStyles(this._getOutlinedLabelOffset())});for(let e of this._prefixSuffixContainers())this._outlineLabelOffsetResizeObserver.observe(e,{box:"border-box"})}return this._getOutlinedLabelOffset()},write:e=>this._writeOutlinedLabelStyles(e())})}_shouldAlwaysFloat(){return this.floatLabel==="always"}_hasOutline(){return this.appearance==="outline"}_forceDisplayInfixLabel(){return!this._platform.isBrowser&&this._prefixChildren.length&&!this._shouldLabelFloat()}_hasFloatingLabel=Ee(()=>!!this._labelChild());_shouldLabelFloat(){return this._hasFloatingLabel()?this._control.shouldLabelFloat||this._shouldAlwaysFloat():!1}_shouldForward(e){let t=this._control?this._control.ngControl:null;return t&&t[e]}_getSubscriptMessageType(){return this._errorChildren&&this._errorChildren.length>0&&this._control.errorState?"error":"hint"}_handleLabelResized(){this._refreshOutlineNotchWidth()}_refreshOutlineNotchWidth(){!this._hasOutline()||!this._floatingLabel||!this._shouldLabelFloat()?this._notchedOutline?._setNotchWidth(0):this._notchedOutline?._setNotchWidth(this._floatingLabel.getWidth())}_processHints(){this._validateHints(),this._syncDescribedByIds()}_validateHints(){this._hintChildren}_syncDescribedByIds(){if(this._control){let e=[];if(this._control.userAriaDescribedBy&&typeof this._control.userAriaDescribedBy=="string"&&e.push(...this._control.userAriaDescribedBy.split(" ")),this._getSubscriptMessageType()==="hint"){let o=this._hintChildren?this._hintChildren.find(m=>m.align==="start"):null,r=this._hintChildren?this._hintChildren.find(m=>m.align==="end"):null;o?e.push(o.id):this._hintLabel&&e.push(this._hintLabelId),r&&e.push(r.id)}else this._errorChildren&&e.push(...this._errorChildren.map(o=>o.id));let t=this._control.describedByIds,n;if(t){let o=this._describedByIds||e;n=e.concat(t.filter(r=>r&&!o.includes(r)))}else n=e;this._control.setDescribedByIds(n),this._describedByIds=e}}_getOutlinedLabelOffset(){if(!this._hasOutline()||!this._floatingLabel)return null;if(!this._iconPrefixContainer&&!this._textPrefixContainer)return["",null];if(!this._isAttachedToDom())return null;let e=this._iconPrefixContainer?.nativeElement,t=this._textPrefixContainer?.nativeElement,n=this._iconSuffixContainer?.nativeElement,o=this._textSuffixContainer?.nativeElement,r=e?.getBoundingClientRect().width??0,m=t?.getBoundingClientRect().width??0,g=n?.getBoundingClientRect().width??0,C=o?.getBoundingClientRect().width??0,x=this._currentDirection==="rtl"?"-1":"1",S=`${r+m}px`,de=`calc(${x} * (${S} + var(--mat-mdc-form-field-label-offset-x, 0px)))`,oe=`var(--mat-mdc-form-field-label-transform, ${Uo} translateX(${de}))`,ve=r+m+g+C;return[oe,ve]}_writeOutlinedLabelStyles(e){if(e!==null){let[t,n]=e;this._floatingLabel&&(this._floatingLabel.element.style.transform=t),n!==null&&this._notchedOutline?._setMaxWidth(n)}}_isAttachedToDom(){let e=this._elementRef.nativeElement;if(e.getRootNode){let t=e.getRootNode();return t&&t!==e}return document.documentElement.contains(e)}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-form-field"]],contentQueries:function(t,n,o){if(t&1&&(Ai(o,n._labelChild,Xn,5),Ht(o,Tt,5)(o,Wo,5)(o,_a,5)(o,jo,5)(o,Un,5)),t&2){Mt();let r;F(r=L())&&(n._formFieldControl=r.first),F(r=L())&&(n._prefixChildren=r),F(r=L())&&(n._suffixChildren=r),F(r=L())&&(n._errorChildren=r),F(r=L())&&(n._hintChildren=r)}},viewQuery:function(t,n){if(t&1&&(Yt(n._iconPrefixContainerSignal,ra,5)(n._textPrefixContainerSignal,sa,5)(n._iconSuffixContainerSignal,la,5)(n._textSuffixContainerSignal,da,5),_e(wo,5)(ra,5)(sa,5)(la,5)(da,5)(ca,5)(ua,5)(ma,5)),t&2){Mt(4);let o;F(o=L())&&(n._textField=o.first),F(o=L())&&(n._iconPrefixContainer=o.first),F(o=L())&&(n._textPrefixContainer=o.first),F(o=L())&&(n._iconSuffixContainer=o.first),F(o=L())&&(n._textSuffixContainer=o.first),F(o=L())&&(n._floatingLabel=o.first),F(o=L())&&(n._notchedOutline=o.first),F(o=L())&&(n._lineRipple=o.first)}},hostAttrs:[1,"mat-mdc-form-field"],hostVars:38,hostBindings:function(t,n){t&2&&D("mat-mdc-form-field-label-always-float",n._shouldAlwaysFloat())("mat-mdc-form-field-has-icon-prefix",n._hasIconPrefix)("mat-mdc-form-field-has-icon-suffix",n._hasIconSuffix)("mat-form-field-invalid",n._control.errorState)("mat-form-field-disabled",n._control.disabled)("mat-form-field-autofilled",n._control.autofilled)("mat-form-field-appearance-fill",n.appearance=="fill")("mat-form-field-appearance-outline",n.appearance=="outline")("mat-form-field-hide-placeholder",n._hasFloatingLabel()&&!n._shouldLabelFloat())("mat-primary",n.color!=="accent"&&n.color!=="warn")("mat-accent",n.color==="accent")("mat-warn",n.color==="warn")("ng-untouched",n._shouldForward("untouched"))("ng-touched",n._shouldForward("touched"))("ng-pristine",n._shouldForward("pristine"))("ng-dirty",n._shouldForward("dirty"))("ng-valid",n._shouldForward("valid"))("ng-invalid",n._shouldForward("invalid"))("ng-pending",n._shouldForward("pending"))},inputs:{hideRequiredMarker:"hideRequiredMarker",color:"color",floatLabel:"floatLabel",appearance:"appearance",subscriptSizing:"subscriptSizing",hintLabel:"hintLabel"},exportAs:["matFormField"],features:[X([{provide:$e,useExisting:i},{provide:ga,useExisting:i}])],ngContentSelectors:ko,decls:18,vars:21,consts:[["labelTemplate",""],["textField",""],["iconPrefixContainer",""],["textPrefixContainer",""],["textSuffixContainer",""],["iconSuffixContainer",""],[1,"mat-mdc-text-field-wrapper","mdc-text-field",3,"click"],[1,"mat-mdc-form-field-focus-overlay"],[1,"mat-mdc-form-field-flex"],["matFormFieldNotchedOutline","",3,"matFormFieldNotchedOutlineOpen"],[1,"mat-mdc-form-field-icon-prefix"],[1,"mat-mdc-form-field-text-prefix"],[1,"mat-mdc-form-field-infix"],[3,"ngTemplateOutlet"],[1,"mat-mdc-form-field-text-suffix"],[1,"mat-mdc-form-field-icon-suffix"],["matFormFieldLineRipple",""],["aria-atomic","true","aria-live","polite",1,"mat-mdc-form-field-subscript-wrapper","mat-mdc-form-field-bottom-align"],[1,"mat-mdc-form-field-error-wrapper"],[1,"mat-mdc-form-field-hint-wrapper"],["matFormFieldFloatingLabel","",3,"floating","monitorResize","id"],["aria-hidden","true",1,"mat-mdc-form-field-required-marker","mdc-floating-label--required"],[3,"id"],[1,"mat-mdc-form-field-hint-spacer"]],template:function(t,n){if(t&1&&(ie(Do),Ve(0,Eo,1,1,"ng-template",null,0,$t),c(2,"div",6,1),f("click",function(r){return n._control.onContainerClick(r)}),v(4,Ao,1,0,"div",7),c(5,"div",8),v(6,Oo,2,2,"div",9),v(7,Io,3,0,"div",10),v(8,Ro,3,0,"div",11),c(9,"div",12),v(10,Fo,1,1,null,13),z(11),p(),v(12,Lo,3,0,"div",14),v(13,Bo,3,0,"div",15),p(),v(14,zo,1,0,"div",16),p(),c(15,"div",17),v(16,No,2,0,"div",18)(17,Yo,5,1,"div",19),p()),t&2){let o;l(2),D("mdc-text-field--filled",!n._hasOutline())("mdc-text-field--outlined",n._hasOutline())("mdc-text-field--no-label",!n._hasFloatingLabel())("mdc-text-field--disabled",n._control.disabled)("mdc-text-field--invalid",n._control.errorState),l(2),y(!n._hasOutline()&&!n._control.disabled?4:-1),l(2),y(n._hasOutline()?6:-1),l(),y(n._hasIconPrefix?7:-1),l(),y(n._hasTextPrefix?8:-1),l(2),y(!n._hasOutline()||n._forceDisplayInfixLabel()?10:-1),l(2),y(n._hasTextSuffix?12:-1),l(),y(n._hasIconSuffix?13:-1),l(),y(n._hasOutline()?-1:14),l(),D("mat-mdc-form-field-subscript-dynamic-size",n.subscriptSizing==="dynamic");let r=n._getSubscriptMessageType();l(),y((o=r)==="error"?16:o==="hint"?17:-1)}},dependencies:[ca,ua,zi,ma,Un],styles:[`.mdc-text-field {
  display: inline-flex;
  align-items: baseline;
  padding: 0 16px;
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  will-change: opacity, transform, color;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}

.mdc-text-field__input {
  width: 100%;
  min-width: 0;
  border: none;
  border-radius: 0;
  background: none;
  padding: 0;
  -moz-appearance: none;
  -webkit-appearance: none;
  height: 28px;
}
.mdc-text-field__input::-webkit-calendar-picker-indicator, .mdc-text-field__input::-webkit-search-cancel-button {
  display: none;
}
.mdc-text-field__input::-ms-clear {
  display: none;
}
.mdc-text-field__input:focus {
  outline: none;
}
.mdc-text-field__input:invalid {
  box-shadow: none;
}
.mdc-text-field__input::placeholder {
  opacity: 0;
}
.mdc-text-field__input::-moz-placeholder {
  opacity: 0;
}
.mdc-text-field__input::-webkit-input-placeholder {
  opacity: 0;
}
.mdc-text-field__input:-ms-input-placeholder {
  opacity: 0;
}
.mdc-text-field--no-label .mdc-text-field__input::placeholder, .mdc-text-field--focused .mdc-text-field__input::placeholder {
  opacity: 1;
}
.mdc-text-field--no-label .mdc-text-field__input::-moz-placeholder, .mdc-text-field--focused .mdc-text-field__input::-moz-placeholder {
  opacity: 1;
}
.mdc-text-field--no-label .mdc-text-field__input::-webkit-input-placeholder, .mdc-text-field--focused .mdc-text-field__input::-webkit-input-placeholder {
  opacity: 1;
}
.mdc-text-field--no-label .mdc-text-field__input:-ms-input-placeholder, .mdc-text-field--focused .mdc-text-field__input:-ms-input-placeholder {
  opacity: 1;
}
.mdc-text-field--disabled:not(.mdc-text-field--no-label) .mdc-text-field__input.mat-mdc-input-disabled-interactive::placeholder {
  opacity: 0;
}
.mdc-text-field--disabled:not(.mdc-text-field--no-label) .mdc-text-field__input.mat-mdc-input-disabled-interactive::-moz-placeholder {
  opacity: 0;
}
.mdc-text-field--disabled:not(.mdc-text-field--no-label) .mdc-text-field__input.mat-mdc-input-disabled-interactive::-webkit-input-placeholder {
  opacity: 0;
}
.mdc-text-field--disabled:not(.mdc-text-field--no-label) .mdc-text-field__input.mat-mdc-input-disabled-interactive:-ms-input-placeholder {
  opacity: 0;
}
.mdc-text-field--outlined .mdc-text-field__input, .mdc-text-field--filled.mdc-text-field--no-label .mdc-text-field__input {
  height: 100%;
}
.mdc-text-field--outlined .mdc-text-field__input {
  display: flex;
  border: none !important;
  background-color: transparent;
}
.mdc-text-field--disabled .mdc-text-field__input {
  pointer-events: auto;
}
.mdc-text-field--filled:not(.mdc-text-field--disabled) .mdc-text-field__input {
  color: var(--mat-form-field-filled-input-text-color, var(--mat-sys-on-surface));
  caret-color: var(--mat-form-field-filled-caret-color, var(--mat-sys-primary));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled) .mdc-text-field__input::placeholder {
  color: var(--mat-form-field-filled-input-text-placeholder-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled) .mdc-text-field__input::-moz-placeholder {
  color: var(--mat-form-field-filled-input-text-placeholder-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled) .mdc-text-field__input::-webkit-input-placeholder {
  color: var(--mat-form-field-filled-input-text-placeholder-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled) .mdc-text-field__input:-ms-input-placeholder {
  color: var(--mat-form-field-filled-input-text-placeholder-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-text-field__input {
  color: var(--mat-form-field-outlined-input-text-color, var(--mat-sys-on-surface));
  caret-color: var(--mat-form-field-outlined-caret-color, var(--mat-sys-primary));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-text-field__input::placeholder {
  color: var(--mat-form-field-outlined-input-text-placeholder-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-text-field__input::-moz-placeholder {
  color: var(--mat-form-field-outlined-input-text-placeholder-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-text-field__input::-webkit-input-placeholder {
  color: var(--mat-form-field-outlined-input-text-placeholder-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-text-field__input:-ms-input-placeholder {
  color: var(--mat-form-field-outlined-input-text-placeholder-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--filled.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-text-field__input {
  caret-color: var(--mat-form-field-filled-error-caret-color, var(--mat-sys-error));
}
.mdc-text-field--outlined.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-text-field__input {
  caret-color: var(--mat-form-field-outlined-error-caret-color, var(--mat-sys-error));
}
.mdc-text-field--filled.mdc-text-field--disabled .mdc-text-field__input {
  color: var(--mat-form-field-filled-disabled-input-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mdc-text-field--outlined.mdc-text-field--disabled .mdc-text-field__input {
  color: var(--mat-form-field-outlined-disabled-input-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
@media (forced-colors: active) {
  .mdc-text-field--disabled .mdc-text-field__input {
    background-color: Window;
  }
}

.mdc-text-field--filled {
  height: 56px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
  border-top-left-radius: var(--mat-form-field-filled-container-shape, var(--mat-sys-corner-extra-small));
  border-top-right-radius: var(--mat-form-field-filled-container-shape, var(--mat-sys-corner-extra-small));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled) {
  background-color: var(--mat-form-field-filled-container-color, var(--mat-sys-surface-variant));
}
.mdc-text-field--filled.mdc-text-field--disabled {
  background-color: var(--mat-form-field-filled-disabled-container-color, color-mix(in srgb, var(--mat-sys-on-surface) 4%, transparent));
}

.mdc-text-field--outlined {
  height: 56px;
  overflow: visible;
  padding-right: max(16px, var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small)));
  padding-left: max(16px, var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small)) + 4px);
}
[dir=rtl] .mdc-text-field--outlined {
  padding-right: max(16px, var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small)) + 4px);
  padding-left: max(16px, var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small)));
}

.mdc-floating-label {
  position: absolute;
  left: 0;
  transform-origin: left top;
  line-height: 1.15rem;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
  overflow: hidden;
  will-change: transform;
}
[dir=rtl] .mdc-floating-label {
  right: 0;
  left: auto;
  transform-origin: right top;
  text-align: right;
}
.mdc-text-field .mdc-floating-label {
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
.mdc-notched-outline .mdc-floating-label {
  display: inline-block;
  position: relative;
  max-width: 100%;
}
.mdc-text-field--outlined .mdc-floating-label {
  left: 4px;
  right: auto;
}
[dir=rtl] .mdc-text-field--outlined .mdc-floating-label {
  left: auto;
  right: 4px;
}
.mdc-text-field--filled .mdc-floating-label {
  left: 16px;
  right: auto;
}
[dir=rtl] .mdc-text-field--filled .mdc-floating-label {
  left: auto;
  right: 16px;
}
.mdc-text-field--disabled .mdc-floating-label {
  cursor: default;
}
@media (forced-colors: active) {
  .mdc-text-field--disabled .mdc-floating-label {
    z-index: 1;
  }
}
.mdc-text-field--filled.mdc-text-field--no-label .mdc-floating-label {
  display: none;
}
.mdc-text-field--filled:not(.mdc-text-field--disabled) .mdc-floating-label {
  color: var(--mat-form-field-filled-label-text-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-floating-label {
  color: var(--mat-form-field-filled-focus-label-text-color, var(--mat-sys-primary));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-floating-label {
  color: var(--mat-form-field-filled-hover-label-text-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--filled.mdc-text-field--disabled .mdc-floating-label {
  color: var(--mat-form-field-filled-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled).mdc-text-field--invalid .mdc-floating-label {
  color: var(--mat-form-field-filled-error-label-text-color, var(--mat-sys-error));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled).mdc-text-field--invalid.mdc-text-field--focused .mdc-floating-label {
  color: var(--mat-form-field-filled-error-focus-label-text-color, var(--mat-sys-error));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled).mdc-text-field--invalid:not(.mdc-text-field--disabled):hover .mdc-floating-label {
  color: var(--mat-form-field-filled-error-hover-label-text-color, var(--mat-sys-on-error-container));
}
.mdc-text-field--filled .mdc-floating-label {
  font-family: var(--mat-form-field-filled-label-text-font, var(--mat-sys-body-large-font));
  font-size: var(--mat-form-field-filled-label-text-size, var(--mat-sys-body-large-size));
  font-weight: var(--mat-form-field-filled-label-text-weight, var(--mat-sys-body-large-weight));
  letter-spacing: var(--mat-form-field-filled-label-text-tracking, var(--mat-sys-body-large-tracking));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled) .mdc-floating-label {
  color: var(--mat-form-field-outlined-label-text-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-floating-label {
  color: var(--mat-form-field-outlined-focus-label-text-color, var(--mat-sys-primary));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-floating-label {
  color: var(--mat-form-field-outlined-hover-label-text-color, var(--mat-sys-on-surface));
}
.mdc-text-field--outlined.mdc-text-field--disabled .mdc-floating-label {
  color: var(--mat-form-field-outlined-disabled-label-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--invalid .mdc-floating-label {
  color: var(--mat-form-field-outlined-error-label-text-color, var(--mat-sys-error));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--invalid.mdc-text-field--focused .mdc-floating-label {
  color: var(--mat-form-field-outlined-error-focus-label-text-color, var(--mat-sys-error));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--invalid:not(.mdc-text-field--disabled):hover .mdc-floating-label {
  color: var(--mat-form-field-outlined-error-hover-label-text-color, var(--mat-sys-on-error-container));
}
.mdc-text-field--outlined .mdc-floating-label {
  font-family: var(--mat-form-field-outlined-label-text-font, var(--mat-sys-body-large-font));
  font-size: var(--mat-form-field-outlined-label-text-size, var(--mat-sys-body-large-size));
  font-weight: var(--mat-form-field-outlined-label-text-weight, var(--mat-sys-body-large-weight));
  letter-spacing: var(--mat-form-field-outlined-label-text-tracking, var(--mat-sys-body-large-tracking));
}

.mdc-floating-label--float-above {
  cursor: auto;
  transform: translateY(-106%) scale(0.75);
}
.mdc-text-field--filled .mdc-floating-label--float-above {
  transform: translateY(-106%) scale(0.75);
}
.mdc-text-field--outlined .mdc-floating-label--float-above {
  transform: translateY(-37.25px) scale(1);
  font-size: 0.75rem;
}
.mdc-notched-outline .mdc-floating-label--float-above {
  text-overflow: clip;
}
.mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  max-width: 133.3333333333%;
}
.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above, .mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  transform: translateY(-34.75px) scale(0.75);
}
.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above, .mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  font-size: 1rem;
}

.mdc-floating-label--required:not(.mdc-floating-label--hide-required-marker)::after {
  margin-left: 1px;
  margin-right: 0;
  content: "*";
}
[dir=rtl] .mdc-floating-label--required:not(.mdc-floating-label--hide-required-marker)::after {
  margin-left: 0;
  margin-right: 1px;
}

.mdc-notched-outline {
  display: flex;
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  height: 100%;
  text-align: left;
  pointer-events: none;
}
[dir=rtl] .mdc-notched-outline {
  text-align: right;
}
.mdc-text-field--outlined .mdc-notched-outline {
  z-index: 1;
}

.mat-mdc-notch-piece {
  box-sizing: border-box;
  height: 100%;
  pointer-events: none;
  border: none;
  border-top: 1px solid;
  border-bottom: 1px solid;
}
.mdc-text-field--focused .mat-mdc-notch-piece {
  border-width: 2px;
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled) .mat-mdc-notch-piece {
  border-color: var(--mat-form-field-outlined-outline-color, var(--mat-sys-outline));
  border-width: var(--mat-form-field-outlined-outline-width, 1px);
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mat-mdc-notch-piece {
  border-color: var(--mat-form-field-outlined-hover-outline-color, var(--mat-sys-on-surface));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--focused .mat-mdc-notch-piece {
  border-color: var(--mat-form-field-outlined-focus-outline-color, var(--mat-sys-primary));
}
.mdc-text-field--outlined.mdc-text-field--disabled .mat-mdc-notch-piece {
  border-color: var(--mat-form-field-outlined-disabled-outline-color, color-mix(in srgb, var(--mat-sys-on-surface) 12%, transparent));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--invalid .mat-mdc-notch-piece {
  border-color: var(--mat-form-field-outlined-error-outline-color, var(--mat-sys-error));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--invalid:not(.mdc-text-field--focused):hover .mdc-notched-outline .mat-mdc-notch-piece {
  border-color: var(--mat-form-field-outlined-error-hover-outline-color, var(--mat-sys-on-error-container));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--invalid.mdc-text-field--focused .mat-mdc-notch-piece {
  border-color: var(--mat-form-field-outlined-error-focus-outline-color, var(--mat-sys-error));
}
.mdc-text-field--outlined:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-notched-outline .mat-mdc-notch-piece {
  border-width: var(--mat-form-field-outlined-focus-outline-width, 2px);
}

.mdc-notched-outline__leading {
  border-left: 1px solid;
  border-right: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small));
  border-bottom-left-radius: var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small));
}
.mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__leading {
  width: max(12px, var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small)));
}
[dir=rtl] .mdc-notched-outline__leading {
  border-left: none;
  border-right: 1px solid;
  border-bottom-left-radius: 0;
  border-top-left-radius: 0;
  border-top-right-radius: var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small));
  border-bottom-right-radius: var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small));
}

.mdc-notched-outline__trailing {
  flex-grow: 1;
  border-left: none;
  border-right: 1px solid;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small));
  border-bottom-right-radius: var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small));
}
[dir=rtl] .mdc-notched-outline__trailing {
  border-left: 1px solid;
  border-right: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small));
  border-bottom-left-radius: var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small));
}

.mdc-notched-outline__notch {
  flex: 0 0 auto;
  width: auto;
}
.mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__notch {
  max-width: min(var(--mat-form-field-notch-max-width, 100%), calc(100% - max(12px, var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small))) * 2));
}
.mdc-text-field--outlined .mdc-notched-outline--notched .mdc-notched-outline__notch {
  max-width: min(100%, calc(100% - max(12px, var(--mat-form-field-outlined-container-shape, var(--mat-sys-corner-extra-small))) * 2));
}
.mdc-text-field--outlined .mdc-notched-outline--notched .mdc-notched-outline__notch {
  padding-top: 1px;
}
.mdc-text-field--focused.mdc-text-field--outlined .mdc-notched-outline--notched .mdc-notched-outline__notch {
  padding-top: 2px;
}
.mdc-notched-outline--notched .mdc-notched-outline__notch {
  padding-left: 0;
  padding-right: 8px;
  border-top: none;
}
[dir=rtl] .mdc-notched-outline--notched .mdc-notched-outline__notch {
  padding-left: 8px;
  padding-right: 0;
}
.mdc-notched-outline--no-label .mdc-notched-outline__notch {
  display: none;
}

.mdc-line-ripple::before, .mdc-line-ripple::after {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  border-bottom-style: solid;
  content: "";
}
.mdc-line-ripple::before {
  z-index: 1;
  border-bottom-width: var(--mat-form-field-filled-active-indicator-height, 1px);
}
.mdc-text-field--filled:not(.mdc-text-field--disabled) .mdc-line-ripple::before {
  border-bottom-color: var(--mat-form-field-filled-active-indicator-color, var(--mat-sys-on-surface-variant));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-line-ripple::before {
  border-bottom-color: var(--mat-form-field-filled-hover-active-indicator-color, var(--mat-sys-on-surface));
}
.mdc-text-field--filled.mdc-text-field--disabled .mdc-line-ripple::before {
  border-bottom-color: var(--mat-form-field-filled-disabled-active-indicator-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled).mdc-text-field--invalid .mdc-line-ripple::before {
  border-bottom-color: var(--mat-form-field-filled-error-active-indicator-color, var(--mat-sys-error));
}
.mdc-text-field--filled:not(.mdc-text-field--disabled).mdc-text-field--invalid:not(.mdc-text-field--focused):hover .mdc-line-ripple::before {
  border-bottom-color: var(--mat-form-field-filled-error-hover-active-indicator-color, var(--mat-sys-on-error-container));
}
.mdc-line-ripple::after {
  transform: scaleX(0);
  opacity: 0;
  z-index: 2;
}
.mdc-text-field--filled .mdc-line-ripple::after {
  border-bottom-width: var(--mat-form-field-filled-focus-active-indicator-height, 2px);
}
.mdc-text-field--filled:not(.mdc-text-field--disabled) .mdc-line-ripple::after {
  border-bottom-color: var(--mat-form-field-filled-focus-active-indicator-color, var(--mat-sys-primary));
}
.mdc-text-field--filled.mdc-text-field--invalid:not(.mdc-text-field--disabled) .mdc-line-ripple::after {
  border-bottom-color: var(--mat-form-field-filled-error-focus-active-indicator-color, var(--mat-sys-error));
}

.mdc-line-ripple--active::after {
  transform: scaleX(1);
  opacity: 1;
}

.mdc-line-ripple--deactivating::after {
  opacity: 0;
}

.mdc-text-field--disabled {
  pointer-events: none;
}

.mat-mdc-form-field-textarea-control {
  vertical-align: middle;
  resize: vertical;
  box-sizing: border-box;
  height: auto;
  margin: 0;
  padding: 0;
  border: none;
  overflow: auto;
}

.mat-mdc-form-field-input-control.mat-mdc-form-field-input-control {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  font: inherit;
  letter-spacing: inherit;
  text-decoration: inherit;
  text-transform: inherit;
  border: none;
}

.mat-mdc-form-field .mat-mdc-floating-label.mdc-floating-label {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  line-height: normal;
  pointer-events: all;
  will-change: auto;
}

.mat-mdc-form-field:not(.mat-form-field-disabled) .mat-mdc-floating-label.mdc-floating-label {
  cursor: inherit;
}

.mdc-text-field--no-label:not(.mdc-text-field--textarea) .mat-mdc-form-field-input-control.mdc-text-field__input,
.mat-mdc-text-field-wrapper .mat-mdc-form-field-input-control {
  height: auto;
}

.mat-mdc-text-field-wrapper .mat-mdc-form-field-input-control.mdc-text-field__input[type=color] {
  height: 23px;
}

.mat-mdc-text-field-wrapper {
  height: auto;
  flex: auto;
  will-change: auto;
}

.mat-mdc-form-field-has-icon-prefix .mat-mdc-text-field-wrapper {
  padding-left: 0;
  --mat-mdc-form-field-label-offset-x: -16px;
}

.mat-mdc-form-field-has-icon-suffix .mat-mdc-text-field-wrapper {
  padding-right: 0;
}

[dir=rtl] .mat-mdc-text-field-wrapper {
  padding-left: 16px;
  padding-right: 16px;
}
[dir=rtl] .mat-mdc-form-field-has-icon-suffix .mat-mdc-text-field-wrapper {
  padding-left: 0;
}
[dir=rtl] .mat-mdc-form-field-has-icon-prefix .mat-mdc-text-field-wrapper {
  padding-right: 0;
}

.mat-form-field-disabled .mdc-text-field__input::placeholder {
  color: var(--mat-form-field-disabled-input-text-placeholder-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-form-field-disabled .mdc-text-field__input::-moz-placeholder {
  color: var(--mat-form-field-disabled-input-text-placeholder-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-form-field-disabled .mdc-text-field__input::-webkit-input-placeholder {
  color: var(--mat-form-field-disabled-input-text-placeholder-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-form-field-disabled .mdc-text-field__input:-ms-input-placeholder {
  color: var(--mat-form-field-disabled-input-text-placeholder-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}

.mat-mdc-form-field-label-always-float .mdc-text-field__input::placeholder {
  transition-delay: 40ms;
  transition-duration: 110ms;
  opacity: 1;
}

.mat-mdc-text-field-wrapper .mat-mdc-form-field-infix .mat-mdc-floating-label {
  left: auto;
  right: auto;
}

.mat-mdc-text-field-wrapper.mdc-text-field--outlined .mdc-text-field__input {
  display: inline-block;
}

.mat-mdc-form-field .mat-mdc-text-field-wrapper.mdc-text-field .mdc-notched-outline__notch {
  padding-top: 0;
}

.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field .mdc-notched-outline__notch {
  border-left: 1px solid transparent;
}

[dir=rtl] .mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field .mdc-notched-outline__notch {
  border-left: none;
  border-right: 1px solid transparent;
}

.mat-mdc-form-field-infix {
  min-height: var(--mat-form-field-container-height, 56px);
  padding-top: var(--mat-form-field-filled-with-label-container-padding-top, 24px);
  padding-bottom: var(--mat-form-field-filled-with-label-container-padding-bottom, 8px);
}
.mdc-text-field--outlined .mat-mdc-form-field-infix, .mdc-text-field--no-label .mat-mdc-form-field-infix {
  padding-top: var(--mat-form-field-container-vertical-padding, 16px);
  padding-bottom: var(--mat-form-field-container-vertical-padding, 16px);
}

.mat-mdc-text-field-wrapper .mat-mdc-form-field-flex .mat-mdc-floating-label {
  top: calc(var(--mat-form-field-container-height, 56px) / 2);
}

.mdc-text-field--filled .mat-mdc-floating-label {
  display: var(--mat-form-field-filled-label-display, block);
}

.mat-mdc-text-field-wrapper.mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  --mat-mdc-form-field-label-transform: translateY(calc(calc(6.75px + var(--mat-form-field-container-height, 56px) / 2) * -1))
    scale(var(--mat-mdc-form-field-floating-label-scale, 0.75));
  transform: var(--mat-mdc-form-field-label-transform);
}

@keyframes _mat-form-field-subscript-animation {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.mat-mdc-form-field-subscript-wrapper {
  box-sizing: border-box;
  width: 100%;
  position: relative;
}

.mat-mdc-form-field-hint-wrapper,
.mat-mdc-form-field-error-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 0 16px;
  opacity: 1;
  transform: translateY(0);
  animation: _mat-form-field-subscript-animation 0ms cubic-bezier(0.55, 0, 0.55, 0.2);
}

.mat-mdc-form-field-subscript-dynamic-size .mat-mdc-form-field-hint-wrapper,
.mat-mdc-form-field-subscript-dynamic-size .mat-mdc-form-field-error-wrapper {
  position: static;
}

.mat-mdc-form-field-bottom-align::before {
  content: "";
  display: inline-block;
  height: 16px;
}

.mat-mdc-form-field-bottom-align.mat-mdc-form-field-subscript-dynamic-size::before {
  content: unset;
}

.mat-mdc-form-field-hint-end {
  order: 1;
}

.mat-mdc-form-field-hint-wrapper {
  display: flex;
}

.mat-mdc-form-field-hint-spacer {
  flex: 1 0 1em;
}

.mat-mdc-form-field-error {
  display: block;
  color: var(--mat-form-field-error-text-color, var(--mat-sys-error));
}

.mat-mdc-form-field-subscript-wrapper,
.mat-mdc-form-field-bottom-align::before {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  font-family: var(--mat-form-field-subscript-text-font, var(--mat-sys-body-small-font));
  line-height: var(--mat-form-field-subscript-text-line-height, var(--mat-sys-body-small-line-height));
  font-size: var(--mat-form-field-subscript-text-size, var(--mat-sys-body-small-size));
  letter-spacing: var(--mat-form-field-subscript-text-tracking, var(--mat-sys-body-small-tracking));
  font-weight: var(--mat-form-field-subscript-text-weight, var(--mat-sys-body-small-weight));
}

.mat-mdc-form-field-focus-overlay {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  opacity: 0;
  pointer-events: none;
  background-color: var(--mat-form-field-state-layer-color, var(--mat-sys-on-surface));
}
.mat-mdc-text-field-wrapper:hover .mat-mdc-form-field-focus-overlay {
  opacity: var(--mat-form-field-hover-state-layer-opacity, var(--mat-sys-hover-state-layer-opacity));
}
.mat-mdc-form-field.mat-focused .mat-mdc-form-field-focus-overlay {
  opacity: var(--mat-form-field-focus-state-layer-opacity, 0);
}

select.mat-mdc-form-field-input-control {
  -moz-appearance: none;
  -webkit-appearance: none;
  background-color: transparent;
  display: inline-flex;
  box-sizing: border-box;
}
select.mat-mdc-form-field-input-control:not(:disabled) {
  cursor: pointer;
}
select.mat-mdc-form-field-input-control:not(.mat-mdc-native-select-inline) option {
  color: var(--mat-form-field-select-option-text-color, var(--mat-sys-neutral10));
}
select.mat-mdc-form-field-input-control:not(.mat-mdc-native-select-inline) option:disabled {
  color: var(--mat-form-field-select-disabled-option-text-color, color-mix(in srgb, var(--mat-sys-neutral10) 38%, transparent));
}

.mat-mdc-form-field-type-mat-native-select .mat-mdc-form-field-infix::after {
  content: "";
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid;
  position: absolute;
  right: 0;
  top: 50%;
  margin-top: -2.5px;
  pointer-events: none;
  color: var(--mat-form-field-enabled-select-arrow-color, var(--mat-sys-on-surface-variant));
}
[dir=rtl] .mat-mdc-form-field-type-mat-native-select .mat-mdc-form-field-infix::after {
  right: auto;
  left: 0;
}
.mat-mdc-form-field-type-mat-native-select.mat-focused .mat-mdc-form-field-infix::after {
  color: var(--mat-form-field-focus-select-arrow-color, var(--mat-sys-primary));
}
.mat-mdc-form-field-type-mat-native-select.mat-form-field-disabled .mat-mdc-form-field-infix::after {
  color: var(--mat-form-field-disabled-select-arrow-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-mdc-form-field-type-mat-native-select .mat-mdc-form-field-input-control {
  padding-right: 15px;
}
[dir=rtl] .mat-mdc-form-field-type-mat-native-select .mat-mdc-form-field-input-control {
  padding-right: 0;
  padding-left: 15px;
}

@media (forced-colors: active) {
  .mat-form-field-appearance-fill .mat-mdc-text-field-wrapper {
    outline: solid 1px;
  }
}
@media (forced-colors: active) {
  .mat-form-field-appearance-fill.mat-form-field-disabled .mat-mdc-text-field-wrapper {
    outline-color: GrayText;
  }
}

@media (forced-colors: active) {
  .mat-form-field-appearance-fill.mat-focused .mat-mdc-text-field-wrapper {
    outline: dashed 3px;
  }
}

@media (forced-colors: active) {
  .mat-mdc-form-field.mat-focused .mdc-notched-outline {
    border: dashed 3px;
  }
}

.mat-mdc-form-field-input-control[type=date], .mat-mdc-form-field-input-control[type=datetime], .mat-mdc-form-field-input-control[type=datetime-local], .mat-mdc-form-field-input-control[type=month], .mat-mdc-form-field-input-control[type=week], .mat-mdc-form-field-input-control[type=time] {
  line-height: 1;
}
.mat-mdc-form-field-input-control::-webkit-datetime-edit {
  line-height: 1;
  padding: 0;
  margin-bottom: -2px;
}

.mat-mdc-form-field {
  --mat-mdc-form-field-floating-label-scale: 0.75;
  display: inline-flex;
  flex-direction: column;
  min-width: 0;
  text-align: left;
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  font-family: var(--mat-form-field-container-text-font, var(--mat-sys-body-large-font));
  line-height: var(--mat-form-field-container-text-line-height, var(--mat-sys-body-large-line-height));
  font-size: var(--mat-form-field-container-text-size, var(--mat-sys-body-large-size));
  letter-spacing: var(--mat-form-field-container-text-tracking, var(--mat-sys-body-large-tracking));
  font-weight: var(--mat-form-field-container-text-weight, var(--mat-sys-body-large-weight));
}
.mat-mdc-form-field .mdc-text-field--outlined .mdc-floating-label--float-above {
  font-size: calc(var(--mat-form-field-outlined-label-text-populated-size) * var(--mat-mdc-form-field-floating-label-scale));
}
.mat-mdc-form-field .mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  font-size: var(--mat-form-field-outlined-label-text-populated-size);
}
[dir=rtl] .mat-mdc-form-field {
  text-align: right;
}

.mat-mdc-form-field-flex {
  display: inline-flex;
  align-items: baseline;
  box-sizing: border-box;
  width: 100%;
}

.mat-mdc-text-field-wrapper {
  width: 100%;
  z-index: 0;
}

.mat-mdc-form-field-icon-prefix,
.mat-mdc-form-field-icon-suffix {
  align-self: center;
  line-height: 0;
  pointer-events: auto;
  position: relative;
  z-index: 1;
}
.mat-mdc-form-field-icon-prefix > .mat-icon,
.mat-mdc-form-field-icon-suffix > .mat-icon {
  padding: 0 12px;
  box-sizing: content-box;
}

.mat-mdc-form-field-icon-prefix {
  color: var(--mat-form-field-leading-icon-color, var(--mat-sys-on-surface-variant));
}
.mat-form-field-disabled .mat-mdc-form-field-icon-prefix {
  color: var(--mat-form-field-disabled-leading-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}

.mat-mdc-form-field-icon-suffix {
  color: var(--mat-form-field-trailing-icon-color, var(--mat-sys-on-surface-variant));
}
.mat-form-field-disabled .mat-mdc-form-field-icon-suffix {
  color: var(--mat-form-field-disabled-trailing-icon-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-form-field-invalid .mat-mdc-form-field-icon-suffix {
  color: var(--mat-form-field-error-trailing-icon-color, var(--mat-sys-error));
}
.mat-form-field-invalid:not(.mat-focused):not(.mat-form-field-disabled) .mat-mdc-text-field-wrapper:hover .mat-mdc-form-field-icon-suffix {
  color: var(--mat-form-field-error-hover-trailing-icon-color, var(--mat-sys-on-error-container));
}
.mat-form-field-invalid.mat-focused .mat-mdc-text-field-wrapper .mat-mdc-form-field-icon-suffix {
  color: var(--mat-form-field-error-focus-trailing-icon-color, var(--mat-sys-error));
}

.mat-mdc-form-field-icon-prefix,
[dir=rtl] .mat-mdc-form-field-icon-suffix {
  padding: 0 4px 0 0;
}

.mat-mdc-form-field-icon-suffix,
[dir=rtl] .mat-mdc-form-field-icon-prefix {
  padding: 0 0 0 4px;
}

.mat-mdc-form-field-subscript-wrapper .mat-icon,
.mat-mdc-form-field label .mat-icon {
  width: 1em;
  height: 1em;
  font-size: inherit;
}

.mat-mdc-form-field-infix {
  flex: auto;
  min-width: 0;
  width: 180px;
  position: relative;
  box-sizing: border-box;
}
.mat-mdc-form-field-infix:has(textarea[cols]) {
  width: auto;
}

.mat-mdc-form-field .mdc-notched-outline__notch {
  margin-left: -1px;
  -webkit-clip-path: inset(-9em -999em -9em 1px);
  clip-path: inset(-9em -999em -9em 1px);
}
[dir=rtl] .mat-mdc-form-field .mdc-notched-outline__notch {
  margin-left: 0;
  margin-right: -1px;
  -webkit-clip-path: inset(-9em 1px -9em -999em);
  clip-path: inset(-9em 1px -9em -999em);
}

.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-floating-label {
  transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field__input {
  transition: opacity 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field__input::placeholder {
  transition: opacity 67ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field__input::-moz-placeholder {
  transition: opacity 67ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field__input::-webkit-input-placeholder {
  transition: opacity 67ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field__input:-ms-input-placeholder {
  transition: opacity 67ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--no-label .mdc-text-field__input::placeholder, .mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--focused .mdc-text-field__input::placeholder {
  transition-delay: 40ms;
  transition-duration: 110ms;
}
.mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--no-label .mdc-text-field__input::-moz-placeholder, .mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--focused .mdc-text-field__input::-moz-placeholder {
  transition-delay: 40ms;
  transition-duration: 110ms;
}
.mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--no-label .mdc-text-field__input::-webkit-input-placeholder, .mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--focused .mdc-text-field__input::-webkit-input-placeholder {
  transition-delay: 40ms;
  transition-duration: 110ms;
}
.mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--no-label .mdc-text-field__input:-ms-input-placeholder, .mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--focused .mdc-text-field__input:-ms-input-placeholder {
  transition-delay: 40ms;
  transition-duration: 110ms;
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field--filled:not(.mdc-ripple-upgraded):focus .mdc-text-field__ripple::before {
  transition-duration: 75ms;
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-line-ripple::after {
  transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 180ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mat-mdc-form-field-hint-wrapper,
.mat-mdc-form-field.mat-form-field-animations-enabled .mat-mdc-form-field-error-wrapper {
  animation-duration: 300ms;
}

.mdc-notched-outline .mdc-floating-label {
  max-width: calc(100% + 1px);
}

.mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  max-width: calc(133.3333333333% + 1px);
}
`],encapsulation:2,changeDetection:0})}return i})();var Ko=20,ht=(()=>{class i{_ngZone=s(V);_platform=s(te);_renderer=s(Re).createRenderer(null,null);_cleanupGlobalListener;constructor(){}_scrolled=new O;_scrolledCount=0;scrollContainers=new Map;register(e){this.scrollContainers.has(e)||this.scrollContainers.set(e,e.elementScrolled().subscribe(()=>this._scrolled.next(e)))}deregister(e){let t=this.scrollContainers.get(e);t&&(t.unsubscribe(),this.scrollContainers.delete(e))}scrolled(e=Ko){return this._platform.isBrowser?new Lt(t=>{this._cleanupGlobalListener||(this._cleanupGlobalListener=this._ngZone.runOutsideAngular(()=>this._renderer.listen("document","scroll",()=>this._scrolled.next())));let n=e>0?this._scrolled.pipe(In(e)).subscribe(t):this._scrolled.subscribe(t);return this._scrolledCount++,()=>{n.unsubscribe(),this._scrolledCount--,this._scrolledCount||(this._cleanupGlobalListener?.(),this._cleanupGlobalListener=void 0)}}):ct()}ngOnDestroy(){this._cleanupGlobalListener?.(),this._cleanupGlobalListener=void 0,this.scrollContainers.forEach((e,t)=>this.deregister(t)),this._scrolled.complete()}ancestorScrolled(e,t){let n=this.getAncestorScrollContainers(e);return this.scrolled(t).pipe(Ae(o=>!o||n.indexOf(o)>-1))}getAncestorScrollContainers(e){let t=[];return this.scrollContainers.forEach((n,o)=>{this._scrollableContainsElement(o,e)&&t.push(o)}),t}_scrollableContainsElement(e,t){let n=Pt(t),o=e.getElementRef().nativeElement;do if(n==o)return!0;while(n=n.parentElement);return!1}static \u0275fac=function(t){return new(t||i)};static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})();var Go=20,ft=(()=>{class i{_platform=s(te);_listeners;_viewportSize=null;_change=new O;_document=s(re);constructor(){let e=s(V),t=s(Re).createRenderer(null,null);e.runOutsideAngular(()=>{if(this._platform.isBrowser){let n=o=>this._change.next(o);this._listeners=[t.listen("window","resize",n),t.listen("window","orientationchange",n)]}this.change().subscribe(()=>this._viewportSize=null)})}ngOnDestroy(){this._listeners?.forEach(e=>e()),this._change.complete()}getViewportSize(){this._viewportSize||this._updateViewportSize();let e={width:this._viewportSize.width,height:this._viewportSize.height};return this._platform.isBrowser||(this._viewportSize=null),e}getViewportRect(){let e=this.getViewportScrollPosition(),{width:t,height:n}=this.getViewportSize();return{top:e.top,left:e.left,bottom:e.top+n,right:e.left+t,height:n,width:t}}getViewportScrollPosition(){if(!this._platform.isBrowser)return{top:0,left:0};let e=this._document,t=this._getWindow(),n=e.documentElement,o=n.getBoundingClientRect(),r=-o.top||e.body?.scrollTop||t.scrollY||n.scrollTop||0,m=-o.left||e.body?.scrollLeft||t.scrollX||n.scrollLeft||0;return{top:r,left:m}}change(e=Go){return e>0?this._change.pipe(In(e)):this._change}_getWindow(){return this._document.defaultView||window}_updateViewportSize(){let e=this._getWindow();this._viewportSize=this._platform.isBrowser?{width:e.innerWidth,height:e.innerHeight}:{width:0,height:0}}static \u0275fac=function(t){return new(t||i)};static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})();var ot=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=$({type:i});static \u0275inj=q({})}return i})(),Gn=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=$({type:i});static \u0275inj=q({imports:[ge,ot,ge,ot]})}return i})();var Ot=class{_attachedHost=null;attach(a){return this._attachedHost=a,a.attach(this)}detach(){let a=this._attachedHost;a!=null&&(this._attachedHost=null,a.detach())}get isAttached(){return this._attachedHost!=null}setAttachedHost(a){this._attachedHost=a}},Xe=class extends Ot{component;viewContainerRef;injector;projectableNodes;bindings;constructor(a,e,t,n,o){super(),this.component=a,this.viewContainerRef=e,this.injector=t,this.projectableNodes=n,this.bindings=o||null}},Ue=class extends Ot{templateRef;viewContainerRef;context;injector;constructor(a,e,t,n){super(),this.templateRef=a,this.viewContainerRef=e,this.context=t,this.injector=n}get origin(){return this.templateRef.elementRef}attach(a,e=this.context){return this.context=e,super.attach(a)}detach(){return this.context=void 0,super.detach()}},Zn=class extends Ot{element;constructor(a){super(),this.element=a instanceof A?a.nativeElement:a}},hn=class{_attachedPortal=null;_disposeFn=null;_isDisposed=!1;hasAttached(){return!!this._attachedPortal}attach(a){if(a instanceof Xe)return this._attachedPortal=a,this.attachComponentPortal(a);if(a instanceof Ue)return this._attachedPortal=a,this.attachTemplatePortal(a);if(this.attachDomPortal&&a instanceof Zn)return this._attachedPortal=a,this.attachDomPortal(a)}attachDomPortal=null;detach(){this._attachedPortal&&(this._attachedPortal.setAttachedHost(null),this._attachedPortal=null),this._invokeDisposeFn()}dispose(){this.hasAttached()&&this.detach(),this._invokeDisposeFn(),this._isDisposed=!0}setDisposeFn(a){this._disposeFn=a}_invokeDisposeFn(){this._disposeFn&&(this._disposeFn(),this._disposeFn=null)}},fn=class extends hn{outletElement;_appRef;_defaultInjector;constructor(a,e,t){super(),this.outletElement=a,this._appRef=e,this._defaultInjector=t}attachComponentPortal(a){let e;if(a.viewContainerRef){let t=a.injector||a.viewContainerRef.injector,n=t.get(Ln,null,{optional:!0})||void 0;e=a.viewContainerRef.createComponent(a.component,{index:a.viewContainerRef.length,injector:t,ngModuleRef:n,projectableNodes:a.projectableNodes||void 0,bindings:a.bindings||void 0}),this.setDisposeFn(()=>e.destroy())}else{let t=this._appRef,n=a.injector||this._defaultInjector||j.NULL,o=n.get(zt,t.injector);e=Li(a.component,{elementInjector:n,environmentInjector:o,projectableNodes:a.projectableNodes||void 0,bindings:a.bindings||void 0}),t.attachView(e.hostView),this.setDisposeFn(()=>{t.viewCount>0&&t.detachView(e.hostView),e.destroy()})}return this.outletElement.appendChild(this._getComponentRootNode(e)),this._attachedPortal=a,e}attachTemplatePortal(a){let e=a.viewContainerRef,t=e.createEmbeddedView(a.templateRef,a.context,{injector:a.injector});return t.rootNodes.forEach(n=>this.outletElement.appendChild(n)),t.detectChanges(),this.setDisposeFn(()=>{let n=e.indexOf(t);n!==-1&&e.remove(n)}),this._attachedPortal=a,t}attachDomPortal=a=>{let e=a.element;e.parentNode;let t=this.outletElement.ownerDocument.createComment("dom-portal");e.parentNode.insertBefore(t,e),this.outletElement.appendChild(e),this._attachedPortal=a,super.setDisposeFn(()=>{t.parentNode&&t.parentNode.replaceChild(e,t)})};dispose(){super.dispose(),this.outletElement.remove()}_getComponentRootNode(a){return a.hostView.rootNodes[0]}};var Qn=(()=>{class i extends hn{_moduleRef=s(Ln,{optional:!0});_document=s(re);_viewContainerRef=s(De);_isInitialized=!1;_attachedRef=null;constructor(){super()}get portal(){return this._attachedPortal}set portal(e){this.hasAttached()&&!e&&!this._isInitialized||(this.hasAttached()&&super.detach(),e&&super.attach(e),this._attachedPortal=e||null)}attached=new M;get attachedRef(){return this._attachedRef}ngOnInit(){this._isInitialized=!0}ngOnDestroy(){super.dispose(),this._attachedRef=this._attachedPortal=null}attachComponentPortal(e){e.setAttachedHost(this);let t=e.viewContainerRef!=null?e.viewContainerRef:this._viewContainerRef,n=t.createComponent(e.component,{index:t.length,injector:e.injector||t.injector,projectableNodes:e.projectableNodes||void 0,ngModuleRef:this._moduleRef||void 0,bindings:e.bindings||void 0});return t!==this._viewContainerRef&&this._getRootNode().appendChild(n.hostView.rootNodes[0]),super.setDisposeFn(()=>n.destroy()),this._attachedPortal=e,this._attachedRef=n,this.attached.emit(n),n}attachTemplatePortal(e){e.setAttachedHost(this);let t=this._viewContainerRef.createEmbeddedView(e.templateRef,e.context,{injector:e.injector});return super.setDisposeFn(()=>this._viewContainerRef.clear()),this._attachedPortal=e,this._attachedRef=t,this.attached.emit(t),t}attachDomPortal=e=>{let t=e.element;t.parentNode;let n=this._document.createComment("dom-portal");e.setAttachedHost(this),t.parentNode.insertBefore(n,t),this._getRootNode().appendChild(t),this._attachedPortal=e,super.setDisposeFn(()=>{n.parentNode&&n.parentNode.replaceChild(t,n)})};_getRootNode(){let e=this._viewContainerRef.element.nativeElement;return e.nodeType===e.ELEMENT_NODE?e:e.parentNode}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["","cdkPortalOutlet",""]],inputs:{portal:[0,"cdkPortalOutlet","portal"]},outputs:{attached:"attached"},exportAs:["cdkPortalOutlet"],features:[ce]})}return i})(),_n=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=$({type:i});static \u0275inj=q({})}return i})();var ba=Gi();function wn(i){return new gn(i.get(ft),i.get(re))}var gn=class{_viewportRuler;_previousHTMLStyles={top:"",left:""};_previousScrollPosition;_isEnabled=!1;_document;constructor(a,e){this._viewportRuler=a,this._document=e}attach(){}enable(){if(this._canBeEnabled()){let a=this._document.documentElement;this._previousScrollPosition=this._viewportRuler.getViewportScrollPosition(),this._previousHTMLStyles.left=a.style.left||"",this._previousHTMLStyles.top=a.style.top||"",a.style.left=Y(-this._previousScrollPosition.left),a.style.top=Y(-this._previousScrollPosition.top),a.classList.add("cdk-global-scrollblock"),this._isEnabled=!0}}disable(){if(this._isEnabled){let a=this._document.documentElement,e=this._document.body,t=a.style,n=e.style,o=t.scrollBehavior||"",r=n.scrollBehavior||"";this._isEnabled=!1,t.left=this._previousHTMLStyles.left,t.top=this._previousHTMLStyles.top,a.classList.remove("cdk-global-scrollblock"),ba&&(t.scrollBehavior=n.scrollBehavior="auto"),window.scroll(this._previousScrollPosition.left,this._previousScrollPosition.top),ba&&(t.scrollBehavior=o,n.scrollBehavior=r)}}_canBeEnabled(){if(this._document.documentElement.classList.contains("cdk-global-scrollblock")||this._isEnabled)return!1;let e=this._document.documentElement,t=this._viewportRuler.getViewportSize();return e.scrollHeight>t.height||e.scrollWidth>t.width}};function ka(i,a){return new bn(i.get(ht),i.get(V),i.get(ft),a)}var bn=class{_scrollDispatcher;_ngZone;_viewportRuler;_config;_scrollSubscription=null;_overlayRef;_initialScrollPosition;constructor(a,e,t,n){this._scrollDispatcher=a,this._ngZone=e,this._viewportRuler=t,this._config=n}attach(a){this._overlayRef,this._overlayRef=a}enable(){if(this._scrollSubscription)return;let a=this._scrollDispatcher.scrolled(0).pipe(Ae(e=>!e||!this._overlayRef.overlayElement.contains(e.getElementRef().nativeElement)));this._config&&this._config.threshold&&this._config.threshold>1?(this._initialScrollPosition=this._viewportRuler.getViewportScrollPosition().top,this._scrollSubscription=a.subscribe(()=>{let e=this._viewportRuler.getViewportScrollPosition().top;Math.abs(e-this._initialScrollPosition)>this._config.threshold?this._detach():this._overlayRef.updatePosition()})):this._scrollSubscription=a.subscribe(this._detach)}disable(){this._scrollSubscription&&(this._scrollSubscription.unsubscribe(),this._scrollSubscription=null)}detach(){this.disable(),this._overlayRef=null}_detach=()=>{this.disable(),this._overlayRef.hasAttached()&&this._ngZone.run(()=>this._overlayRef.detach())}};var It=class{enable(){}disable(){}attach(){}};function Jn(i,a){return a.some(e=>{let t=i.bottom<e.top,n=i.top>e.bottom,o=i.right<e.left,r=i.left>e.right;return t||n||o||r})}function va(i,a){return a.some(e=>{let t=i.top<e.top,n=i.bottom>e.bottom,o=i.left<e.left,r=i.right>e.right;return t||n||o||r})}function Ne(i,a){return new vn(i.get(ht),i.get(ft),i.get(V),a)}var vn=class{_scrollDispatcher;_viewportRuler;_ngZone;_config;_scrollSubscription=null;_overlayRef;constructor(a,e,t,n){this._scrollDispatcher=a,this._viewportRuler=e,this._ngZone=t,this._config=n}attach(a){this._overlayRef,this._overlayRef=a}enable(){if(!this._scrollSubscription){let a=this._config?this._config.scrollThrottle:0;this._scrollSubscription=this._scrollDispatcher.scrolled(a).subscribe(()=>{if(this._overlayRef.updatePosition(),this._config&&this._config.autoClose){let e=this._overlayRef.overlayElement.getBoundingClientRect(),{width:t,height:n}=this._viewportRuler.getViewportSize();Jn(e,[{width:t,height:n,bottom:n,right:t,top:0,left:0}])&&(this.disable(),this._ngZone.run(()=>this._overlayRef.detach()))}})}}disable(){this._scrollSubscription&&(this._scrollSubscription.unsubscribe(),this._scrollSubscription=null)}detach(){this.disable(),this._overlayRef=null}},Ma=(()=>{class i{_injector=s(j);constructor(){}noop=()=>new It;close=e=>ka(this._injector,e);block=()=>wn(this._injector);reposition=e=>Ne(this._injector,e);static \u0275fac=function(t){return new(t||i)};static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})(),st=class{positionStrategy;scrollStrategy=new It;panelClass="";hasBackdrop=!1;backdropClass="cdk-overlay-dark-backdrop";disableAnimations;width;height;minWidth;minHeight;maxWidth;maxHeight;direction;disposeOnNavigation=!1;usePopover;eventPredicate;constructor(a){if(a){let e=Object.keys(a);for(let t of e)a[t]!==void 0&&(this[t]=a[t])}}};var yn=class{connectionPair;scrollableViewProperties;constructor(a,e){this.connectionPair=a,this.scrollableViewProperties=e}};var Sa=(()=>{class i{_attachedOverlays=[];_document=s(re);_isAttached=!1;constructor(){}ngOnDestroy(){this.detach()}add(e){this.remove(e),this._attachedOverlays.push(e)}remove(e){let t=this._attachedOverlays.indexOf(e);t>-1&&this._attachedOverlays.splice(t,1),this._attachedOverlays.length===0&&this.detach()}canReceiveEvent(e,t,n){return n.observers.length<1?!1:e.eventPredicate?e.eventPredicate(t):!0}static \u0275fac=function(t){return new(t||i)};static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})(),Ea=(()=>{class i extends Sa{_ngZone=s(V);_renderer=s(Re).createRenderer(null,null);_cleanupKeydown;add(e){super.add(e),this._isAttached||(this._ngZone.runOutsideAngular(()=>{this._cleanupKeydown=this._renderer.listen("body","keydown",this._keydownListener)}),this._isAttached=!0)}detach(){this._isAttached&&(this._cleanupKeydown?.(),this._isAttached=!1)}_keydownListener=e=>{let t=this._attachedOverlays;for(let n=t.length-1;n>-1;n--){let o=t[n];if(this.canReceiveEvent(o,e,o._keydownEvents)){this._ngZone.run(()=>o._keydownEvents.next(e));break}}};static \u0275fac=(()=>{let e;return function(n){return(e||(e=je(i)))(n||i)}})();static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})(),Aa=(()=>{class i extends Sa{_platform=s(te);_ngZone=s(V);_renderer=s(Re).createRenderer(null,null);_cursorOriginalValue;_cursorStyleIsSet=!1;_pointerDownEventTarget=null;_cleanups;add(e){if(super.add(e),!this._isAttached){let t=this._document.body,n={capture:!0},o=this._renderer;this._cleanups=this._ngZone.runOutsideAngular(()=>[o.listen(t,"pointerdown",this._pointerDownListener,n),o.listen(t,"click",this._clickListener,n),o.listen(t,"auxclick",this._clickListener,n),o.listen(t,"contextmenu",this._clickListener,n)]),this._platform.IOS&&!this._cursorStyleIsSet&&(this._cursorOriginalValue=t.style.cursor,t.style.cursor="pointer",this._cursorStyleIsSet=!0),this._isAttached=!0}}detach(){this._isAttached&&(this._cleanups?.forEach(e=>e()),this._cleanups=void 0,this._platform.IOS&&this._cursorStyleIsSet&&(this._document.body.style.cursor=this._cursorOriginalValue,this._cursorStyleIsSet=!1),this._isAttached=!1)}_pointerDownListener=e=>{this._pointerDownEventTarget=at(e)};_clickListener=e=>{let t=at(e),n=e.type==="click"&&this._pointerDownEventTarget?this._pointerDownEventTarget:t;this._pointerDownEventTarget=null;let o=this._attachedOverlays.slice();for(let r=o.length-1;r>-1;r--){let m=o[r],g=m._outsidePointerEvents;if(!(!m.hasAttached()||!this.canReceiveEvent(m,e,g))){if(ya(m.overlayElement,t)||ya(m.overlayElement,n))break;this._ngZone?this._ngZone.run(()=>g.next(e)):g.next(e)}}};static \u0275fac=(()=>{let e;return function(n){return(e||(e=je(i)))(n||i)}})();static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})();function ya(i,a){let e=typeof ShadowRoot<"u"&&ShadowRoot,t=a;for(;t;){if(t===i)return!0;t=e&&t instanceof ShadowRoot?t.host:t.parentNode}return!1}var Pa=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["ng-component"]],hostAttrs:["cdk-overlay-style-loader",""],decls:0,vars:0,template:function(t,n){},styles:[`.cdk-overlay-container, .cdk-global-overlay-wrapper {
  pointer-events: none;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
}

.cdk-overlay-container {
  position: fixed;
}
@layer cdk-overlay {
  .cdk-overlay-container {
    z-index: 1000;
  }
}
.cdk-overlay-container:empty {
  display: none;
}

.cdk-global-overlay-wrapper {
  display: flex;
  position: absolute;
}
@layer cdk-overlay {
  .cdk-global-overlay-wrapper {
    z-index: 1000;
  }
}

.cdk-overlay-pane {
  position: absolute;
  pointer-events: auto;
  box-sizing: border-box;
  display: flex;
  max-width: 100%;
  max-height: 100%;
}
@layer cdk-overlay {
  .cdk-overlay-pane {
    z-index: 1000;
  }
}

.cdk-overlay-backdrop {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  pointer-events: auto;
  -webkit-tap-highlight-color: transparent;
  opacity: 0;
  touch-action: manipulation;
}
@layer cdk-overlay {
  .cdk-overlay-backdrop {
    z-index: 1000;
    transition: opacity 400ms cubic-bezier(0.25, 0.8, 0.25, 1);
  }
}
@media (prefers-reduced-motion) {
  .cdk-overlay-backdrop {
    transition-duration: 1ms;
  }
}

.cdk-overlay-backdrop-showing {
  opacity: 1;
}
@media (forced-colors: active) {
  .cdk-overlay-backdrop-showing {
    opacity: 0.6;
  }
}

@layer cdk-overlay {
  .cdk-overlay-dark-backdrop {
    background: rgba(0, 0, 0, 0.32);
  }
}

.cdk-overlay-transparent-backdrop {
  transition: visibility 1ms linear, opacity 1ms linear;
  visibility: hidden;
  opacity: 1;
}
.cdk-overlay-transparent-backdrop.cdk-overlay-backdrop-showing, .cdk-high-contrast-active .cdk-overlay-transparent-backdrop {
  opacity: 0;
  visibility: visible;
}

.cdk-overlay-backdrop-noop-animation {
  transition: none;
}

.cdk-overlay-connected-position-bounding-box {
  position: absolute;
  display: flex;
  flex-direction: column;
  min-width: 1px;
  min-height: 1px;
}
@layer cdk-overlay {
  .cdk-overlay-connected-position-bounding-box {
    z-index: 1000;
  }
}

.cdk-global-scrollblock {
  position: fixed;
  width: 100%;
  overflow-y: scroll;
}

.cdk-overlay-popover {
  background: none;
  border: none;
  padding: 0;
  outline: 0;
  overflow: visible;
  position: fixed;
  pointer-events: none;
  white-space: normal;
  color: inherit;
  text-decoration: none;
  width: 100%;
  height: 100%;
  inset: auto;
  top: 0;
  left: 0;
}
.cdk-overlay-popover::backdrop {
  display: none;
}
.cdk-overlay-popover .cdk-overlay-backdrop {
  position: fixed;
  z-index: auto;
}
`],encapsulation:2,changeDetection:0})}return i})(),Ta=(()=>{class i{_platform=s(te);_containerElement;_document=s(re);_styleLoader=s(Ce);constructor(){}ngOnDestroy(){this._containerElement?.remove()}getContainerElement(){return this._loadStyles(),this._containerElement||this._createContainer(),this._containerElement}_createContainer(){let e="cdk-overlay-container";if(this._platform.isBrowser||Yn()){let n=this._document.querySelectorAll(`.${e}[platform="server"], .${e}[platform="test"]`);for(let o=0;o<n.length;o++)n[o].remove()}let t=this._document.createElement("div");t.classList.add(e),Yn()?t.setAttribute("platform","test"):this._platform.isBrowser||t.setAttribute("platform","server"),this._document.body.appendChild(t),this._containerElement=t}_loadStyles(){this._styleLoader.load(Pa)}static \u0275fac=function(t){return new(t||i)};static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})(),ei=class{_renderer;_ngZone;element;_cleanupClick;_cleanupTransitionEnd;_fallbackTimeout;constructor(a,e,t,n){this._renderer=e,this._ngZone=t,this.element=a.createElement("div"),this.element.classList.add("cdk-overlay-backdrop"),this._cleanupClick=e.listen(this.element,"click",n)}detach(){this._ngZone.runOutsideAngular(()=>{let a=this.element;clearTimeout(this._fallbackTimeout),this._cleanupTransitionEnd?.(),this._cleanupTransitionEnd=this._renderer.listen(a,"transitionend",this.dispose),this._fallbackTimeout=setTimeout(this.dispose,500),a.style.pointerEvents="none",a.classList.remove("cdk-overlay-backdrop-showing")})}dispose=()=>{clearTimeout(this._fallbackTimeout),this._cleanupClick?.(),this._cleanupTransitionEnd?.(),this._cleanupClick=this._cleanupTransitionEnd=this._fallbackTimeout=void 0,this.element.remove()}};function ni(i){return i&&i.nodeType===1}var xn=class{_portalOutlet;_host;_pane;_config;_ngZone;_keyboardDispatcher;_document;_location;_outsideClickDispatcher;_animationsDisabled;_injector;_renderer;_backdropClick=new O;_attachments=new O;_detachments=new O;_positionStrategy;_scrollStrategy;_locationChanges=N.EMPTY;_backdropRef=null;_detachContentMutationObserver;_detachContentAfterRenderRef;_disposed=!1;_previousHostParent;_keydownEvents=new O;_outsidePointerEvents=new O;_afterNextRenderRef;constructor(a,e,t,n,o,r,m,g,C,x=!1,S,ae){this._portalOutlet=a,this._host=e,this._pane=t,this._config=n,this._ngZone=o,this._keyboardDispatcher=r,this._document=m,this._location=g,this._outsideClickDispatcher=C,this._animationsDisabled=x,this._injector=S,this._renderer=ae,n.scrollStrategy&&(this._scrollStrategy=n.scrollStrategy,this._scrollStrategy.attach(this)),this._positionStrategy=n.positionStrategy}get overlayElement(){return this._pane}get backdropElement(){return this._backdropRef?.element||null}get hostElement(){return this._host}get eventPredicate(){return this._config?.eventPredicate||null}attach(a){if(this._disposed)return null;this._attachHost();let e=this._portalOutlet.attach(a);return this._positionStrategy?.attach(this),this._updateStackingOrder(),this._updateElementSize(),this._updateElementDirection(),this._scrollStrategy&&this._scrollStrategy.enable(),this._afterNextRenderRef?.destroy(),this._afterNextRenderRef=ye(()=>{this.hasAttached()&&this.updatePosition()},{injector:this._injector}),this._togglePointerEvents(!0),this._config.hasBackdrop&&this._attachBackdrop(),this._config.panelClass&&this._toggleClasses(this._pane,this._config.panelClass,!0),this._attachments.next(),this._completeDetachContent(),this._keyboardDispatcher.add(this),this._config.disposeOnNavigation&&(this._locationChanges=this._location.subscribe(()=>this.dispose())),this._outsideClickDispatcher.add(this),typeof e?.onDestroy=="function"&&e.onDestroy(()=>{this.hasAttached()&&this._ngZone.runOutsideAngular(()=>Promise.resolve().then(()=>this.detach()))}),e}detach(){if(!this.hasAttached())return;this.detachBackdrop(),this._togglePointerEvents(!1),this._positionStrategy&&this._positionStrategy.detach&&this._positionStrategy.detach(),this._scrollStrategy&&this._scrollStrategy.disable();let a=this._portalOutlet.detach();return this._detachments.next(),this._completeDetachContent(),this._keyboardDispatcher.remove(this),this._detachContentWhenEmpty(),this._locationChanges.unsubscribe(),this._outsideClickDispatcher.remove(this),a}dispose(){if(this._disposed)return;let a=this.hasAttached();this._positionStrategy&&this._positionStrategy.dispose(),this._disposeScrollStrategy(),this._backdropRef?.dispose(),this._locationChanges.unsubscribe(),this._keyboardDispatcher.remove(this),this._portalOutlet.dispose(),this._attachments.complete(),this._backdropClick.complete(),this._keydownEvents.complete(),this._outsidePointerEvents.complete(),this._outsideClickDispatcher.remove(this),this._host?.remove(),this._afterNextRenderRef?.destroy(),this._previousHostParent=this._pane=this._host=this._backdropRef=null,a&&this._detachments.next(),this._detachments.complete(),this._completeDetachContent(),this._disposed=!0}hasAttached(){return this._portalOutlet.hasAttached()}backdropClick(){return this._backdropClick}attachments(){return this._attachments}detachments(){return this._detachments}keydownEvents(){return this._keydownEvents}outsidePointerEvents(){return this._outsidePointerEvents}getConfig(){return this._config}updatePosition(){this._positionStrategy&&this._positionStrategy.apply()}updatePositionStrategy(a){a!==this._positionStrategy&&(this._positionStrategy&&this._positionStrategy.dispose(),this._positionStrategy=a,this.hasAttached()&&(a.attach(this),this.updatePosition()))}updateSize(a){this._config=Oe(Oe({},this._config),a),this._updateElementSize()}setDirection(a){this._config=yi(Oe({},this._config),{direction:a}),this._updateElementDirection()}addPanelClass(a){this._pane&&this._toggleClasses(this._pane,a,!0)}removePanelClass(a){this._pane&&this._toggleClasses(this._pane,a,!1)}getDirection(){let a=this._config.direction;return a?typeof a=="string"?a:a.value:"ltr"}updateScrollStrategy(a){a!==this._scrollStrategy&&(this._disposeScrollStrategy(),this._scrollStrategy=a,this.hasAttached()&&(a.attach(this),a.enable()))}_updateElementDirection(){this._host.setAttribute("dir",this.getDirection())}_updateElementSize(){if(!this._pane)return;let a=this._pane.style;a.width=Y(this._config.width),a.height=Y(this._config.height),a.minWidth=Y(this._config.minWidth),a.minHeight=Y(this._config.minHeight),a.maxWidth=Y(this._config.maxWidth),a.maxHeight=Y(this._config.maxHeight)}_togglePointerEvents(a){this._pane.style.pointerEvents=a?"":"none"}_attachHost(){if(!this._host.parentElement){let a=this._config.usePopover?this._positionStrategy?.getPopoverInsertionPoint?.():null;ni(a)?a.after(this._host):a?.type==="parent"?a.element.appendChild(this._host):this._previousHostParent?.appendChild(this._host)}if(this._config.usePopover)try{this._host.showPopover()}catch{}}_attachBackdrop(){let a="cdk-overlay-backdrop-showing";this._backdropRef?.dispose(),this._backdropRef=new ei(this._document,this._renderer,this._ngZone,e=>{this._backdropClick.next(e)}),this._animationsDisabled&&this._backdropRef.element.classList.add("cdk-overlay-backdrop-noop-animation"),this._config.backdropClass&&this._toggleClasses(this._backdropRef.element,this._config.backdropClass,!0),this._config.usePopover?this._host.prepend(this._backdropRef.element):this._host.parentElement.insertBefore(this._backdropRef.element,this._host),!this._animationsDisabled&&typeof requestAnimationFrame<"u"?this._ngZone.runOutsideAngular(()=>{requestAnimationFrame(()=>this._backdropRef?.element.classList.add(a))}):this._backdropRef.element.classList.add(a)}_updateStackingOrder(){!this._config.usePopover&&this._host.nextSibling&&this._host.parentNode.appendChild(this._host)}detachBackdrop(){this._animationsDisabled?(this._backdropRef?.dispose(),this._backdropRef=null):this._backdropRef?.detach()}_toggleClasses(a,e,t){let n=Nn(e||[]).filter(o=>!!o);n.length&&(t?a.classList.add(...n):a.classList.remove(...n))}_detachContentWhenEmpty(){let a=!1;try{this._detachContentAfterRenderRef=ye(()=>{a=!0,this._detachContent()},{injector:this._injector})}catch(e){if(a)throw e;this._detachContent()}globalThis.MutationObserver&&this._pane&&(this._detachContentMutationObserver||=new globalThis.MutationObserver(()=>{this._detachContent()}),this._detachContentMutationObserver.observe(this._pane,{childList:!0}))}_detachContent(){(!this._pane||!this._host||this._pane.children.length===0)&&(this._pane&&this._config.panelClass&&this._toggleClasses(this._pane,this._config.panelClass,!1),this._host&&this._host.parentElement&&(this._previousHostParent=this._host.parentElement,this._host.remove()),this._completeDetachContent())}_completeDetachContent(){this._detachContentAfterRenderRef?.destroy(),this._detachContentAfterRenderRef=void 0,this._detachContentMutationObserver?.disconnect()}_disposeScrollStrategy(){let a=this._scrollStrategy;a?.disable(),a?.detach?.()}},xa="cdk-overlay-connected-position-bounding-box",Zo=/([A-Za-z%]+)$/;function He(i,a){return new _t(a,i.get(ft),i.get(re),i.get(te),i.get(Ta))}var _t=class{_viewportRuler;_document;_platform;_overlayContainer;_overlayRef;_isInitialRender=!1;_lastBoundingBoxSize={width:0,height:0};_isPushed=!1;_canPush=!0;_growAfterOpen=!1;_hasFlexibleDimensions=!0;_positionLocked=!1;_originRect;_overlayRect;_viewportRect;_containerRect;_viewportMargin=0;_scrollables=[];_preferredPositions=[];_origin;_pane;_isDisposed=!1;_boundingBox=null;_lastPosition=null;_lastScrollVisibility=null;_positionChanges=new O;_resizeSubscription=N.EMPTY;_offsetX=0;_offsetY=0;_transformOriginSelector;_appliedPanelClasses=[];_previousPushAmount=null;_popoverLocation="global";positionChanges=this._positionChanges;get positions(){return this._preferredPositions}constructor(a,e,t,n,o){this._viewportRuler=e,this._document=t,this._platform=n,this._overlayContainer=o,this.setOrigin(a)}attach(a){this._overlayRef&&this._overlayRef,this._validatePositions(),a.hostElement.classList.add(xa),this._overlayRef=a,this._boundingBox=a.hostElement,this._pane=a.overlayElement,this._isDisposed=!1,this._isInitialRender=!0,this._lastPosition=null,this._resizeSubscription.unsubscribe(),this._resizeSubscription=this._viewportRuler.change().subscribe(()=>{this._isInitialRender=!0,this.apply()})}apply(){if(this._isDisposed||!this._platform.isBrowser)return;if(!this._isInitialRender&&this._positionLocked&&this._lastPosition){this.reapplyLastPosition();return}this._clearPanelClasses(),this._resetOverlayElementStyles(),this._resetBoundingBoxStyles(),this._viewportRect=this._getNarrowedViewportRect(),this._originRect=this._getOriginRect(),this._overlayRect=this._pane.getBoundingClientRect(),this._containerRect=this._getContainerRect();let a=this._originRect,e=this._overlayRect,t=this._viewportRect,n=this._containerRect,o=[],r;for(let m of this._preferredPositions){let g=this._getOriginPoint(a,n,m),C=this._getOverlayPoint(g,e,m),x=this._getOverlayFit(C,e,t,m);if(x.isCompletelyWithinViewport){this._isPushed=!1,this._applyPosition(m,g);return}if(this._canFitWithFlexibleDimensions(x,C,t)){o.push({position:m,origin:g,overlayRect:e,boundingBoxRect:this._calculateBoundingBoxRect(g,m)});continue}(!r||r.overlayFit.visibleArea<x.visibleArea)&&(r={overlayFit:x,overlayPoint:C,originPoint:g,position:m,overlayRect:e})}if(o.length){let m=null,g=-1;for(let C of o){let x=C.boundingBoxRect.width*C.boundingBoxRect.height*(C.position.weight||1);x>g&&(g=x,m=C)}this._isPushed=!1,this._applyPosition(m.position,m.origin);return}if(this._canPush){this._isPushed=!0,this._applyPosition(r.position,r.originPoint);return}this._applyPosition(r.position,r.originPoint)}detach(){this._clearPanelClasses(),this._lastPosition=null,this._previousPushAmount=null,this._resizeSubscription.unsubscribe()}dispose(){this._isDisposed||(this._boundingBox&&rt(this._boundingBox.style,{top:"",left:"",right:"",bottom:"",height:"",width:"",alignItems:"",justifyContent:""}),this._pane&&this._resetOverlayElementStyles(),this._overlayRef&&this._overlayRef.hostElement.classList.remove(xa),this.detach(),this._positionChanges.complete(),this._overlayRef=this._boundingBox=null,this._isDisposed=!0)}reapplyLastPosition(){if(this._isDisposed||!this._platform.isBrowser)return;let a=this._lastPosition;a?(this._originRect=this._getOriginRect(),this._overlayRect=this._pane.getBoundingClientRect(),this._viewportRect=this._getNarrowedViewportRect(),this._containerRect=this._getContainerRect(),this._applyPosition(a,this._getOriginPoint(this._originRect,this._containerRect,a))):this.apply()}withScrollableContainers(a){return this._scrollables=a,this}withPositions(a){return this._preferredPositions=a,a.indexOf(this._lastPosition)===-1&&(this._lastPosition=null),this._validatePositions(),this}withViewportMargin(a){return this._viewportMargin=a,this}withFlexibleDimensions(a=!0){return this._hasFlexibleDimensions=a,this}withGrowAfterOpen(a=!0){return this._growAfterOpen=a,this}withPush(a=!0){return this._canPush=a,this}withLockedPosition(a=!0){return this._positionLocked=a,this}setOrigin(a){return this._origin=a,this}withDefaultOffsetX(a){return this._offsetX=a,this}withDefaultOffsetY(a){return this._offsetY=a,this}withTransformOriginOn(a){return this._transformOriginSelector=a,this}withPopoverLocation(a){return this._popoverLocation=a,this}getPopoverInsertionPoint(){return this._popoverLocation==="global"?null:this._popoverLocation!=="inline"?this._popoverLocation:this._origin instanceof A?this._origin.nativeElement:ni(this._origin)?this._origin:null}_getOriginPoint(a,e,t){let n;if(t.originX=="center")n=a.left+a.width/2;else{let r=this._isRtl()?a.right:a.left,m=this._isRtl()?a.left:a.right;n=t.originX=="start"?r:m}e.left<0&&(n-=e.left);let o;return t.originY=="center"?o=a.top+a.height/2:o=t.originY=="top"?a.top:a.bottom,e.top<0&&(o-=e.top),{x:n,y:o}}_getOverlayPoint(a,e,t){let n;t.overlayX=="center"?n=-e.width/2:t.overlayX==="start"?n=this._isRtl()?-e.width:0:n=this._isRtl()?0:-e.width;let o;return t.overlayY=="center"?o=-e.height/2:o=t.overlayY=="top"?0:-e.height,{x:a.x+n,y:a.y+o}}_getOverlayFit(a,e,t,n){let o=wa(e),{x:r,y:m}=a,g=this._getOffset(n,"x"),C=this._getOffset(n,"y");g&&(r+=g),C&&(m+=C);let x=0-r,S=r+o.width-t.width,ae=0-m,de=m+o.height-t.height,oe=this._subtractOverflows(o.width,x,S),ve=this._subtractOverflows(o.height,ae,de),vi=oe*ve;return{visibleArea:vi,isCompletelyWithinViewport:o.width*o.height===vi,fitsInViewportVertically:ve===o.height,fitsInViewportHorizontally:oe==o.width}}_canFitWithFlexibleDimensions(a,e,t){if(this._hasFlexibleDimensions){let n=t.bottom-e.y,o=t.right-e.x,r=Ca(this._overlayRef.getConfig().minHeight),m=Ca(this._overlayRef.getConfig().minWidth),g=a.fitsInViewportVertically||r!=null&&r<=n,C=a.fitsInViewportHorizontally||m!=null&&m<=o;return g&&C}return!1}_pushOverlayOnScreen(a,e,t){if(this._previousPushAmount&&this._positionLocked)return{x:a.x+this._previousPushAmount.x,y:a.y+this._previousPushAmount.y};let n=wa(e),o=this._viewportRect,r=Math.max(a.x+n.width-o.width,0),m=Math.max(a.y+n.height-o.height,0),g=Math.max(o.top-t.top-a.y,0),C=Math.max(o.left-t.left-a.x,0),x=0,S=0;return n.width<=o.width?x=C||-r:x=a.x<this._getViewportMarginStart()?o.left-t.left-a.x:0,n.height<=o.height?S=g||-m:S=a.y<this._getViewportMarginTop()?o.top-t.top-a.y:0,this._previousPushAmount={x,y:S},{x:a.x+x,y:a.y+S}}_applyPosition(a,e){if(this._setTransformOrigin(a),this._setOverlayElementStyles(e,a),this._setBoundingBoxStyles(e,a),a.panelClass&&this._addPanelClasses(a.panelClass),this._positionChanges.observers.length){let t=this._getScrollVisibility();if(a!==this._lastPosition||!this._lastScrollVisibility||!Qo(this._lastScrollVisibility,t)){let n=new yn(a,t);this._positionChanges.next(n)}this._lastScrollVisibility=t}this._lastPosition=a,this._isInitialRender=!1}_setTransformOrigin(a){if(!this._transformOriginSelector)return;let e=this._boundingBox.querySelectorAll(this._transformOriginSelector),t,n=a.overlayY;a.overlayX==="center"?t="center":this._isRtl()?t=a.overlayX==="start"?"right":"left":t=a.overlayX==="start"?"left":"right";for(let o=0;o<e.length;o++)e[o].style.transformOrigin=`${t} ${n}`}_calculateBoundingBoxRect(a,e){let t=this._viewportRect,n=this._isRtl(),o,r,m;if(e.overlayY==="top")r=a.y,o=t.height-r+this._getViewportMarginBottom();else if(e.overlayY==="bottom")m=t.height-a.y+this._getViewportMarginTop()+this._getViewportMarginBottom(),o=t.height-m+this._getViewportMarginTop();else{let de=Math.min(t.bottom-a.y+t.top,a.y),oe=this._lastBoundingBoxSize.height;o=de*2,r=a.y-de,o>oe&&!this._isInitialRender&&!this._growAfterOpen&&(r=a.y-oe/2)}let g=e.overlayX==="start"&&!n||e.overlayX==="end"&&n,C=e.overlayX==="end"&&!n||e.overlayX==="start"&&n,x,S,ae;if(C)ae=t.width-a.x+this._getViewportMarginStart()+this._getViewportMarginEnd(),x=a.x-this._getViewportMarginStart();else if(g)S=a.x,x=t.right-a.x-this._getViewportMarginEnd();else{let de=Math.min(t.right-a.x+t.left,a.x),oe=this._lastBoundingBoxSize.width;x=de*2,S=a.x-de,x>oe&&!this._isInitialRender&&!this._growAfterOpen&&(S=a.x-oe/2)}return{top:r,left:S,bottom:m,right:ae,width:x,height:o}}_setBoundingBoxStyles(a,e){let t=this._calculateBoundingBoxRect(a,e);!this._isInitialRender&&!this._growAfterOpen&&(t.height=Math.min(t.height,this._lastBoundingBoxSize.height),t.width=Math.min(t.width,this._lastBoundingBoxSize.width));let n={};if(this._hasExactPosition())n.top=n.left="0",n.bottom=n.right="auto",n.maxHeight=n.maxWidth="",n.width=n.height="100%";else{let o=this._overlayRef.getConfig().maxHeight,r=this._overlayRef.getConfig().maxWidth;n.width=Y(t.width),n.height=Y(t.height),n.top=Y(t.top)||"auto",n.bottom=Y(t.bottom)||"auto",n.left=Y(t.left)||"auto",n.right=Y(t.right)||"auto",e.overlayX==="center"?n.alignItems="center":n.alignItems=e.overlayX==="end"?"flex-end":"flex-start",e.overlayY==="center"?n.justifyContent="center":n.justifyContent=e.overlayY==="bottom"?"flex-end":"flex-start",o&&(n.maxHeight=Y(o)),r&&(n.maxWidth=Y(r))}this._lastBoundingBoxSize=t,rt(this._boundingBox.style,n)}_resetBoundingBoxStyles(){rt(this._boundingBox.style,{top:"0",left:"0",right:"0",bottom:"0",height:"",width:"",alignItems:"",justifyContent:""})}_resetOverlayElementStyles(){rt(this._pane.style,{top:"",left:"",bottom:"",right:"",position:"",transform:""})}_setOverlayElementStyles(a,e){let t={},n=this._hasExactPosition(),o=this._hasFlexibleDimensions,r=this._overlayRef.getConfig();if(n){let x=this._viewportRuler.getViewportScrollPosition();rt(t,this._getExactOverlayY(e,a,x)),rt(t,this._getExactOverlayX(e,a,x))}else t.position="static";let m="",g=this._getOffset(e,"x"),C=this._getOffset(e,"y");g&&(m+=`translateX(${g}px) `),C&&(m+=`translateY(${C}px)`),t.transform=m.trim(),r.maxHeight&&(n?t.maxHeight=Y(r.maxHeight):o&&(t.maxHeight="")),r.maxWidth&&(n?t.maxWidth=Y(r.maxWidth):o&&(t.maxWidth="")),rt(this._pane.style,t)}_getExactOverlayY(a,e,t){let n={top:"",bottom:""},o=this._getOverlayPoint(e,this._overlayRect,a);if(this._isPushed&&(o=this._pushOverlayOnScreen(o,this._overlayRect,t)),a.overlayY==="bottom"){let r=this._document.documentElement.clientHeight;n.bottom=`${r-(o.y+this._overlayRect.height)}px`}else n.top=Y(o.y);return n}_getExactOverlayX(a,e,t){let n={left:"",right:""},o=this._getOverlayPoint(e,this._overlayRect,a);this._isPushed&&(o=this._pushOverlayOnScreen(o,this._overlayRect,t));let r;if(this._isRtl()?r=a.overlayX==="end"?"left":"right":r=a.overlayX==="end"?"right":"left",r==="right"){let m=this._document.documentElement.clientWidth;n.right=`${m-(o.x+this._overlayRect.width)}px`}else n.left=Y(o.x);return n}_getScrollVisibility(){let a=this._getOriginRect(),e=this._pane.getBoundingClientRect(),t=this._scrollables.map(n=>n.getElementRef().nativeElement.getBoundingClientRect());return{isOriginClipped:va(a,t),isOriginOutsideView:Jn(a,t),isOverlayClipped:va(e,t),isOverlayOutsideView:Jn(e,t)}}_subtractOverflows(a,...e){return e.reduce((t,n)=>t-Math.max(n,0),a)}_getNarrowedViewportRect(){let a=this._document.documentElement.clientWidth,e=this._document.documentElement.clientHeight,t=this._viewportRuler.getViewportScrollPosition();return{top:t.top+this._getViewportMarginTop(),left:t.left+this._getViewportMarginStart(),right:t.left+a-this._getViewportMarginEnd(),bottom:t.top+e-this._getViewportMarginBottom(),width:a-this._getViewportMarginStart()-this._getViewportMarginEnd(),height:e-this._getViewportMarginTop()-this._getViewportMarginBottom()}}_isRtl(){return this._overlayRef.getDirection()==="rtl"}_hasExactPosition(){return!this._hasFlexibleDimensions||this._isPushed}_getOffset(a,e){return e==="x"?a.offsetX==null?this._offsetX:a.offsetX:a.offsetY==null?this._offsetY:a.offsetY}_validatePositions(){}_addPanelClasses(a){this._pane&&Nn(a).forEach(e=>{e!==""&&this._appliedPanelClasses.indexOf(e)===-1&&(this._appliedPanelClasses.push(e),this._pane.classList.add(e))})}_clearPanelClasses(){this._pane&&(this._appliedPanelClasses.forEach(a=>{this._pane.classList.remove(a)}),this._appliedPanelClasses=[])}_getViewportMarginStart(){return typeof this._viewportMargin=="number"?this._viewportMargin:this._viewportMargin?.start??0}_getViewportMarginEnd(){return typeof this._viewportMargin=="number"?this._viewportMargin:this._viewportMargin?.end??0}_getViewportMarginTop(){return typeof this._viewportMargin=="number"?this._viewportMargin:this._viewportMargin?.top??0}_getViewportMarginBottom(){return typeof this._viewportMargin=="number"?this._viewportMargin:this._viewportMargin?.bottom??0}_getOriginRect(){let a=this._origin;if(a instanceof A)return a.nativeElement.getBoundingClientRect();if(a instanceof Element)return a.getBoundingClientRect();let e=a.width||0,t=a.height||0;return{top:a.y,bottom:a.y+t,left:a.x,right:a.x+e,height:t,width:e}}_getContainerRect(){let a=this._overlayRef.getConfig().usePopover&&this._popoverLocation!=="global",e=this._overlayContainer.getContainerElement();a&&(e.style.display="block");let t=e.getBoundingClientRect();return a&&(e.style.display=""),t}};function rt(i,a){for(let e in a)a.hasOwnProperty(e)&&(i[e]=a[e]);return i}function Ca(i){if(typeof i!="number"&&i!=null){let[a,e]=i.split(Zo);return!e||e==="px"?parseFloat(a):null}return i||null}function wa(i){return{top:Math.floor(i.top),right:Math.floor(i.right),bottom:Math.floor(i.bottom),left:Math.floor(i.left),width:Math.floor(i.width),height:Math.floor(i.height)}}function Qo(i,a){return i===a?!0:i.isOriginClipped===a.isOriginClipped&&i.isOriginOutsideView===a.isOriginOutsideView&&i.isOverlayClipped===a.isOverlayClipped&&i.isOverlayOutsideView===a.isOverlayOutsideView}var Da="cdk-global-overlay-wrapper";function Dn(i){return new Cn}var Cn=class{_overlayRef;_cssPosition="static";_topOffset="";_bottomOffset="";_alignItems="";_xPosition="";_xOffset="";_width="";_height="";_isDisposed=!1;attach(a){let e=a.getConfig();this._overlayRef=a,this._width&&!e.width&&a.updateSize({width:this._width}),this._height&&!e.height&&a.updateSize({height:this._height}),a.hostElement.classList.add(Da),this._isDisposed=!1}top(a=""){return this._bottomOffset="",this._topOffset=a,this._alignItems="flex-start",this}left(a=""){return this._xOffset=a,this._xPosition="left",this}bottom(a=""){return this._topOffset="",this._bottomOffset=a,this._alignItems="flex-end",this}right(a=""){return this._xOffset=a,this._xPosition="right",this}start(a=""){return this._xOffset=a,this._xPosition="start",this}end(a=""){return this._xOffset=a,this._xPosition="end",this}width(a=""){return this._overlayRef?this._overlayRef.updateSize({width:a}):this._width=a,this}height(a=""){return this._overlayRef?this._overlayRef.updateSize({height:a}):this._height=a,this}centerHorizontally(a=""){return this.left(a),this._xPosition="center",this}centerVertically(a=""){return this.top(a),this._alignItems="center",this}apply(){if(!this._overlayRef||!this._overlayRef.hasAttached())return;let a=this._overlayRef.overlayElement.style,e=this._overlayRef.hostElement.style,t=this._overlayRef.getConfig(),{width:n,height:o,maxWidth:r,maxHeight:m}=t,g=(n==="100%"||n==="100vw")&&(!r||r==="100%"||r==="100vw"),C=(o==="100%"||o==="100vh")&&(!m||m==="100%"||m==="100vh"),x=this._xPosition,S=this._xOffset,ae=this._overlayRef.getConfig().direction==="rtl",de="",oe="",ve="";g?ve="flex-start":x==="center"?(ve="center",ae?oe=S:de=S):ae?x==="left"||x==="end"?(ve="flex-end",de=S):(x==="right"||x==="start")&&(ve="flex-start",oe=S):x==="left"||x==="start"?(ve="flex-start",de=S):(x==="right"||x==="end")&&(ve="flex-end",oe=S),a.position=this._cssPosition,a.marginLeft=g?"0":de,a.marginTop=C?"0":this._topOffset,a.marginBottom=this._bottomOffset,a.marginRight=g?"0":oe,e.justifyContent=ve,e.alignItems=C?"flex-start":this._alignItems}dispose(){if(this._isDisposed||!this._overlayRef)return;let a=this._overlayRef.overlayElement.style,e=this._overlayRef.hostElement,t=e.style;e.classList.remove(Da),t.justifyContent=t.alignItems=a.marginTop=a.marginBottom=a.marginLeft=a.marginRight=a.position="",this._overlayRef=null,this._isDisposed=!0}},Oa=(()=>{class i{_injector=s(j);constructor(){}global(){return Dn()}flexibleConnectedTo(e){return He(this._injector,e)}static \u0275fac=function(t){return new(t||i)};static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})(),ii=new B("OVERLAY_DEFAULT_CONFIG");function Ye(i,a){i.get(Ce).load(Pa);let e=i.get(Ta),t=i.get(re),n=i.get(me),o=i.get(Bn),r=i.get(le),m=i.get(Q,null,{optional:!0})||i.get(Re).createRenderer(null,null),g=new st(a),C=i.get(ii,null,{optional:!0})?.usePopover??!0;g.direction=g.direction||r.value,"showPopover"in t.body?g.usePopover=a?.usePopover??C:g.usePopover=!1;let x=t.createElement("div"),S=t.createElement("div");x.id=n.getId("cdk-overlay-"),x.classList.add("cdk-overlay-pane"),S.appendChild(x),g.usePopover&&(S.setAttribute("popover","manual"),S.classList.add("cdk-overlay-popover"));let ae=g.usePopover?g.positionStrategy?.getPopoverInsertionPoint?.():null;return ni(ae)?ae.after(S):ae?.type==="parent"?ae.element.appendChild(S):e.getContainerElement().appendChild(S),new xn(new fn(x,o,i),S,x,g,i.get(V),i.get(Ea),t,i.get(Bi),i.get(Aa),a?.disableAnimations??i.get(ki,null,{optional:!0})==="NoopAnimations",i.get(zt),m)}var Ia=(()=>{class i{scrollStrategies=s(Ma);_positionBuilder=s(Oa);_injector=s(j);constructor(){}create(e){return Ye(this._injector,e)}position(){return this._positionBuilder}static \u0275fac=function(t){return new(t||i)};static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})(),Jo=[{originX:"start",originY:"bottom",overlayX:"start",overlayY:"top"},{originX:"start",originY:"top",overlayX:"start",overlayY:"bottom"},{originX:"end",originY:"top",overlayX:"end",overlayY:"bottom"},{originX:"end",originY:"bottom",overlayX:"end",overlayY:"top"}],er=new B("cdk-connected-overlay-scroll-strategy",{providedIn:"root",factory:()=>{let i=s(j);return()=>Ne(i)}}),ti=(()=>{class i{elementRef=s(A);constructor(){}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["","cdk-overlay-origin",""],["","overlay-origin",""],["","cdkOverlayOrigin",""]],exportAs:["cdkOverlayOrigin"]})}return i})(),Ra=new B("cdk-connected-overlay-default-config"),tr=(()=>{class i{_dir=s(le,{optional:!0});_injector=s(j);_overlayRef;_templatePortal;_backdropSubscription=N.EMPTY;_attachSubscription=N.EMPTY;_detachSubscription=N.EMPTY;_positionSubscription=N.EMPTY;_offsetX;_offsetY;_position;_scrollStrategyFactory=s(er);_ngZone=s(V);origin;positions;positionStrategy;get offsetX(){return this._offsetX}set offsetX(e){this._offsetX=e,this._position&&this._updatePositionStrategy(this._position)}get offsetY(){return this._offsetY}set offsetY(e){this._offsetY=e,this._position&&this._updatePositionStrategy(this._position)}width;height;minWidth;minHeight;backdropClass;panelClass;viewportMargin=0;scrollStrategy;open=!1;disableClose=!1;transformOriginSelector;hasBackdrop=!1;lockPosition=!1;flexibleDimensions=!1;growAfterOpen=!1;push=!1;disposeOnNavigation=!1;usePopover;matchWidth=!1;set _config(e){typeof e!="string"&&this._assignConfig(e)}backdropClick=new M;positionChange=new M;attach=new M;detach=new M;overlayKeydown=new M;overlayOutsideClick=new M;constructor(){let e=s(kt),t=s(De),n=s(Ra,{optional:!0}),o=s(ii,{optional:!0});this.usePopover=o?.usePopover===!1?null:"global",this._templatePortal=new Ue(e,t),this.scrollStrategy=this._scrollStrategyFactory(),n&&this._assignConfig(n)}get overlayRef(){return this._overlayRef}get dir(){return this._dir?this._dir.value:"ltr"}ngOnDestroy(){this._attachSubscription.unsubscribe(),this._detachSubscription.unsubscribe(),this._backdropSubscription.unsubscribe(),this._positionSubscription.unsubscribe(),this._overlayRef?.dispose()}ngOnChanges(e){this._position&&(this._updatePositionStrategy(this._position),this._overlayRef?.updateSize({width:this._getWidth(),minWidth:this.minWidth,height:this.height,minHeight:this.minHeight}),e.origin&&this.open&&this._position.apply()),e.open&&(this.open?this.attachOverlay():this.detachOverlay())}_createOverlay(){(!this.positions||!this.positions.length)&&(this.positions=Jo);let e=this._overlayRef=Ye(this._injector,this._buildConfig());this._attachSubscription=e.attachments().subscribe(()=>this.attach.emit()),this._detachSubscription=e.detachments().subscribe(()=>this.detach.emit()),e.keydownEvents().subscribe(t=>{this.overlayKeydown.next(t),t.keyCode===27&&!this.disableClose&&!pe(t)&&(t.preventDefault(),this.detachOverlay())}),this._overlayRef.outsidePointerEvents().subscribe(t=>{let n=this._getOriginElement(),o=at(t);(!n||n!==o&&!n.contains(o))&&this.overlayOutsideClick.next(t)})}_buildConfig(){let e=this._position=this.positionStrategy||this._createPositionStrategy(),t=new st({direction:this._dir||"ltr",positionStrategy:e,scrollStrategy:this.scrollStrategy,hasBackdrop:this.hasBackdrop,disposeOnNavigation:this.disposeOnNavigation,usePopover:!!this.usePopover});return(this.height||this.height===0)&&(t.height=this.height),(this.minWidth||this.minWidth===0)&&(t.minWidth=this.minWidth),(this.minHeight||this.minHeight===0)&&(t.minHeight=this.minHeight),this.backdropClass&&(t.backdropClass=this.backdropClass),this.panelClass&&(t.panelClass=this.panelClass),t}_updatePositionStrategy(e){let t=this.positions.map(n=>({originX:n.originX,originY:n.originY,overlayX:n.overlayX,overlayY:n.overlayY,offsetX:n.offsetX||this.offsetX,offsetY:n.offsetY||this.offsetY,panelClass:n.panelClass||void 0}));return e.setOrigin(this._getOrigin()).withPositions(t).withFlexibleDimensions(this.flexibleDimensions).withPush(this.push).withGrowAfterOpen(this.growAfterOpen).withViewportMargin(this.viewportMargin).withLockedPosition(this.lockPosition).withTransformOriginOn(this.transformOriginSelector).withPopoverLocation(this.usePopover===null?"global":this.usePopover)}_createPositionStrategy(){let e=He(this._injector,this._getOrigin());return this._updatePositionStrategy(e),e}_getOrigin(){return this.origin instanceof ti?this.origin.elementRef:this.origin}_getOriginElement(){return this.origin instanceof ti?this.origin.elementRef.nativeElement:this.origin instanceof A?this.origin.nativeElement:typeof Element<"u"&&this.origin instanceof Element?this.origin:null}_getWidth(){return this.width?this.width:this.matchWidth?this._getOriginElement()?.getBoundingClientRect?.().width:void 0}attachOverlay(){this._overlayRef||this._createOverlay();let e=this._overlayRef;e.getConfig().hasBackdrop=this.hasBackdrop,e.updateSize({width:this._getWidth()}),e.hasAttached()||e.attach(this._templatePortal),this.hasBackdrop?this._backdropSubscription=e.backdropClick().subscribe(t=>this.backdropClick.emit(t)):this._backdropSubscription.unsubscribe(),this._positionSubscription.unsubscribe(),this.positionChange.observers.length>0&&(this._positionSubscription=this._position.positionChanges.pipe(Di(()=>this.positionChange.observers.length>0)).subscribe(t=>{this._ngZone.run(()=>this.positionChange.emit(t)),this.positionChange.observers.length===0&&this._positionSubscription.unsubscribe()})),this.open=!0}detachOverlay(){this._overlayRef?.detach(),this._backdropSubscription.unsubscribe(),this._positionSubscription.unsubscribe(),this.open=!1}_assignConfig(e){this.origin=e.origin??this.origin,this.positions=e.positions??this.positions,this.positionStrategy=e.positionStrategy??this.positionStrategy,this.offsetX=e.offsetX??this.offsetX,this.offsetY=e.offsetY??this.offsetY,this.width=e.width??this.width,this.height=e.height??this.height,this.minWidth=e.minWidth??this.minWidth,this.minHeight=e.minHeight??this.minHeight,this.backdropClass=e.backdropClass??this.backdropClass,this.panelClass=e.panelClass??this.panelClass,this.viewportMargin=e.viewportMargin??this.viewportMargin,this.scrollStrategy=e.scrollStrategy??this.scrollStrategy,this.disableClose=e.disableClose??this.disableClose,this.transformOriginSelector=e.transformOriginSelector??this.transformOriginSelector,this.hasBackdrop=e.hasBackdrop??this.hasBackdrop,this.lockPosition=e.lockPosition??this.lockPosition,this.flexibleDimensions=e.flexibleDimensions??this.flexibleDimensions,this.growAfterOpen=e.growAfterOpen??this.growAfterOpen,this.push=e.push??this.push,this.disposeOnNavigation=e.disposeOnNavigation??this.disposeOnNavigation,this.usePopover=e.usePopover??this.usePopover,this.matchWidth=e.matchWidth??this.matchWidth}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["","cdk-connected-overlay",""],["","connected-overlay",""],["","cdkConnectedOverlay",""]],inputs:{origin:[0,"cdkConnectedOverlayOrigin","origin"],positions:[0,"cdkConnectedOverlayPositions","positions"],positionStrategy:[0,"cdkConnectedOverlayPositionStrategy","positionStrategy"],offsetX:[0,"cdkConnectedOverlayOffsetX","offsetX"],offsetY:[0,"cdkConnectedOverlayOffsetY","offsetY"],width:[0,"cdkConnectedOverlayWidth","width"],height:[0,"cdkConnectedOverlayHeight","height"],minWidth:[0,"cdkConnectedOverlayMinWidth","minWidth"],minHeight:[0,"cdkConnectedOverlayMinHeight","minHeight"],backdropClass:[0,"cdkConnectedOverlayBackdropClass","backdropClass"],panelClass:[0,"cdkConnectedOverlayPanelClass","panelClass"],viewportMargin:[0,"cdkConnectedOverlayViewportMargin","viewportMargin"],scrollStrategy:[0,"cdkConnectedOverlayScrollStrategy","scrollStrategy"],open:[0,"cdkConnectedOverlayOpen","open"],disableClose:[0,"cdkConnectedOverlayDisableClose","disableClose"],transformOriginSelector:[0,"cdkConnectedOverlayTransformOriginOn","transformOriginSelector"],hasBackdrop:[2,"cdkConnectedOverlayHasBackdrop","hasBackdrop",P],lockPosition:[2,"cdkConnectedOverlayLockPosition","lockPosition",P],flexibleDimensions:[2,"cdkConnectedOverlayFlexibleDimensions","flexibleDimensions",P],growAfterOpen:[2,"cdkConnectedOverlayGrowAfterOpen","growAfterOpen",P],push:[2,"cdkConnectedOverlayPush","push",P],disposeOnNavigation:[2,"cdkConnectedOverlayDisposeOnNavigation","disposeOnNavigation",P],usePopover:[0,"cdkConnectedOverlayUsePopover","usePopover"],matchWidth:[2,"cdkConnectedOverlayMatchWidth","matchWidth",P],_config:[0,"cdkConnectedOverlay","_config"]},outputs:{backdropClick:"backdropClick",positionChange:"positionChange",attach:"attach",detach:"detach",overlayKeydown:"overlayKeydown",overlayOutsideClick:"overlayOutsideClick"},exportAs:["cdkConnectedOverlay"],features:[fe]})}return i})(),ai=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=$({type:i});static \u0275inj=q({providers:[Ia],imports:[ge,_n,Gn,Gn]})}return i})();var nr=["tooltip"],ir=20;var ar=new B("mat-tooltip-scroll-strategy",{providedIn:"root",factory:()=>{let i=s(j);return()=>Ne(i,{scrollThrottle:ir})}}),or=new B("mat-tooltip-default-options",{providedIn:"root",factory:()=>({showDelay:0,hideDelay:0,touchendHideDelay:1500})});var Va="tooltip-panel",rr={passive:!0},sr=8,lr=8,dr=24,cr=200,Fa=(()=>{class i{_elementRef=s(A);_ngZone=s(V);_platform=s(te);_ariaDescriber=s(Ki);_focusMonitor=s(ln);_dir=s(le);_injector=s(j);_viewContainerRef=s(De);_mediaMatcher=s(Wi);_document=s(re);_renderer=s(Q);_animationsDisabled=we();_defaultOptions=s(or,{optional:!0});_overlayRef=null;_tooltipInstance=null;_overlayPanelClass;_portal;_position="below";_positionAtOrigin=!1;_disabled=!1;_tooltipClass;_viewInitialized=!1;_pointerExitEventsInitialized=!1;_tooltipComponent=pr;_viewportMargin=8;_currentPosition;_cssClassPrefix="mat-mdc";_ariaDescriptionPending=!1;_dirSubscribed=!1;get position(){return this._position}set position(e){e!==this._position&&(this._position=e,this._overlayRef&&(this._updatePosition(this._overlayRef),this._tooltipInstance?.show(0),this._overlayRef.updatePosition()))}get positionAtOrigin(){return this._positionAtOrigin}set positionAtOrigin(e){this._positionAtOrigin=ze(e),this._detach(),this._overlayRef=null}get disabled(){return this._disabled}set disabled(e){let t=ze(e);this._disabled!==t&&(this._disabled=t,t?this.hide(0):this._setupPointerEnterEventsIfNeeded(),this._syncAriaDescription(this.message))}get showDelay(){return this._showDelay}set showDelay(e){this._showDelay=At(e)}_showDelay;get hideDelay(){return this._hideDelay}set hideDelay(e){this._hideDelay=At(e),this._tooltipInstance&&(this._tooltipInstance._mouseLeaveHideDelay=this._hideDelay)}_hideDelay;touchGestures="auto";get message(){return this._message}set message(e){let t=this._message;this._message=e!=null?String(e).trim():"",!this._message&&this._isTooltipVisible()?this.hide(0):(this._setupPointerEnterEventsIfNeeded(),this._updateTooltipMessage()),this._syncAriaDescription(t)}_message="";get tooltipClass(){return this._tooltipClass}set tooltipClass(e){this._tooltipClass=e,this._tooltipInstance&&this._setTooltipClass(this._tooltipClass)}_eventCleanups=[];_touchstartTimeout=null;_destroyed=new O;_isDestroyed=!1;constructor(){let e=this._defaultOptions;e&&(this._showDelay=e.showDelay,this._hideDelay=e.hideDelay,e.position&&(this.position=e.position),e.positionAtOrigin&&(this.positionAtOrigin=e.positionAtOrigin),e.touchGestures&&(this.touchGestures=e.touchGestures),e.tooltipClass&&(this.tooltipClass=e.tooltipClass)),this._viewportMargin=sr}ngAfterViewInit(){this._viewInitialized=!0,this._setupPointerEnterEventsIfNeeded(),this._focusMonitor.monitor(this._elementRef).pipe(he(this._destroyed)).subscribe(e=>{e?e==="keyboard"&&this._ngZone.run(()=>this.show()):this._ngZone.run(()=>this.hide(0))})}ngOnDestroy(){let e=this._elementRef.nativeElement;this._touchstartTimeout&&clearTimeout(this._touchstartTimeout),this._overlayRef&&(this._overlayRef.dispose(),this._tooltipInstance=null),this._eventCleanups.forEach(t=>t()),this._eventCleanups.length=0,this._destroyed.next(),this._destroyed.complete(),this._isDestroyed=!0,this._ariaDescriber.removeDescription(e,this.message,"tooltip"),this._focusMonitor.stopMonitoring(e)}show(e=this.showDelay,t){if(this.disabled||!this.message||this._isTooltipVisible()){this._tooltipInstance?._cancelPendingAnimations();return}let n=this._createOverlay(t);this._detach(),this._portal=this._portal||new Xe(this._tooltipComponent,this._viewContainerRef);let o=this._tooltipInstance=n.attach(this._portal).instance;o._triggerElement=this._elementRef.nativeElement,o._mouseLeaveHideDelay=this._hideDelay,o.afterHidden().pipe(he(this._destroyed)).subscribe(()=>this._detach()),this._setTooltipClass(this._tooltipClass),this._updateTooltipMessage(),o.show(e)}hide(e=this.hideDelay){let t=this._tooltipInstance;t&&(t.isVisible()?t.hide(e):(t._cancelPendingAnimations(),this._detach()))}toggle(e){this._isTooltipVisible()?this.hide():this.show(void 0,e)}_isTooltipVisible(){return!!this._tooltipInstance&&this._tooltipInstance.isVisible()}_createOverlay(e){if(this._overlayRef){let r=this._overlayRef.getConfig().positionStrategy;if((!this.positionAtOrigin||!e)&&r._origin instanceof A)return this._overlayRef;this._detach()}let t=this._injector.get(ht).getAncestorScrollContainers(this._elementRef),n=`${this._cssClassPrefix}-${Va}`,o=He(this._injector,this.positionAtOrigin?e||this._elementRef:this._elementRef).withTransformOriginOn(`.${this._cssClassPrefix}-tooltip`).withFlexibleDimensions(!1).withViewportMargin(this._viewportMargin).withScrollableContainers(t).withPopoverLocation("global");return o.positionChanges.pipe(he(this._destroyed)).subscribe(r=>{this._updateCurrentPositionClass(r.connectionPair),this._tooltipInstance&&r.scrollableViewProperties.isOverlayClipped&&this._tooltipInstance.isVisible()&&this._ngZone.run(()=>this.hide(0))}),this._overlayRef=Ye(this._injector,{direction:this._dir,positionStrategy:o,panelClass:this._overlayPanelClass?[...this._overlayPanelClass,n]:n,scrollStrategy:this._injector.get(ar)(),disableAnimations:this._animationsDisabled,eventPredicate:this._overlayEventPredicate}),this._updatePosition(this._overlayRef),this._overlayRef.detachments().pipe(he(this._destroyed)).subscribe(()=>this._detach()),this._overlayRef.outsidePointerEvents().pipe(he(this._destroyed)).subscribe(()=>this._tooltipInstance?._handleBodyInteraction()),this._overlayRef.keydownEvents().pipe(he(this._destroyed)).subscribe(r=>{r.preventDefault(),r.stopPropagation(),this._ngZone.run(()=>this.hide(0))}),this._defaultOptions?.disableTooltipInteractivity&&this._overlayRef.addPanelClass(`${this._cssClassPrefix}-tooltip-panel-non-interactive`),this._dirSubscribed||(this._dirSubscribed=!0,this._dir.change.pipe(he(this._destroyed)).subscribe(()=>{this._overlayRef&&this._updatePosition(this._overlayRef)})),this._overlayRef}_detach(){this._overlayRef&&this._overlayRef.hasAttached()&&this._overlayRef.detach(),this._tooltipInstance=null}_updatePosition(e){let t=e.getConfig().positionStrategy,n=this._getOrigin(),o=this._getOverlayPosition();t.withPositions([this._addOffset(Oe(Oe({},n.main),o.main)),this._addOffset(Oe(Oe({},n.fallback),o.fallback))])}_addOffset(e){let t=lr,n=!this._dir||this._dir.value=="ltr";return e.originY==="top"?e.offsetY=-t:e.originY==="bottom"?e.offsetY=t:e.originX==="start"?e.offsetX=n?-t:t:e.originX==="end"&&(e.offsetX=n?t:-t),e}_getOrigin(){let e=!this._dir||this._dir.value=="ltr",t=this.position,n;t=="above"||t=="below"?n={originX:"center",originY:t=="above"?"top":"bottom"}:t=="before"||t=="left"&&e||t=="right"&&!e?n={originX:"start",originY:"center"}:(t=="after"||t=="right"&&e||t=="left"&&!e)&&(n={originX:"end",originY:"center"});let{x:o,y:r}=this._invertPosition(n.originX,n.originY);return{main:n,fallback:{originX:o,originY:r}}}_getOverlayPosition(){let e=!this._dir||this._dir.value=="ltr",t=this.position,n;t=="above"?n={overlayX:"center",overlayY:"bottom"}:t=="below"?n={overlayX:"center",overlayY:"top"}:t=="before"||t=="left"&&e||t=="right"&&!e?n={overlayX:"end",overlayY:"center"}:(t=="after"||t=="right"&&e||t=="left"&&!e)&&(n={overlayX:"start",overlayY:"center"});let{x:o,y:r}=this._invertPosition(n.overlayX,n.overlayY);return{main:n,fallback:{overlayX:o,overlayY:r}}}_updateTooltipMessage(){this._tooltipInstance&&(this._tooltipInstance.message=this.message,this._tooltipInstance._markForCheck(),ye(()=>{this._tooltipInstance&&this._overlayRef.updatePosition()},{injector:this._injector}))}_setTooltipClass(e){this._tooltipInstance&&(this._tooltipInstance.tooltipClass=e instanceof Set?Array.from(e):e,this._tooltipInstance._markForCheck())}_invertPosition(e,t){return this.position==="above"||this.position==="below"?t==="top"?t="bottom":t==="bottom"&&(t="top"):e==="end"?e="start":e==="start"&&(e="end"),{x:e,y:t}}_updateCurrentPositionClass(e){let{overlayY:t,originX:n,originY:o}=e,r;if(t==="center"?this._dir&&this._dir.value==="rtl"?r=n==="end"?"left":"right":r=n==="start"?"left":"right":r=t==="bottom"&&o==="top"?"above":"below",r!==this._currentPosition){let m=this._overlayRef;if(m){let g=`${this._cssClassPrefix}-${Va}-`;m.removePanelClass(g+this._currentPosition),m.addPanelClass(g+r)}this._currentPosition=r}}_setupPointerEnterEventsIfNeeded(){this._disabled||!this.message||!this._viewInitialized||this._eventCleanups.length||(this._isTouchPlatform()?this.touchGestures!=="off"&&(this._disableNativeGesturesIfNecessary(),this._addListener("touchstart",e=>{let t=e.targetTouches?.[0],n=t?{x:t.clientX,y:t.clientY}:void 0;this._setupPointerExitEventsIfNeeded(),this._touchstartTimeout&&clearTimeout(this._touchstartTimeout);let o=500;this._touchstartTimeout=setTimeout(()=>{this._touchstartTimeout=null,this.show(void 0,n)},this._defaultOptions?.touchLongPressShowDelay??o)})):this._addListener("mouseenter",e=>{this._setupPointerExitEventsIfNeeded();let t;e.x!==void 0&&e.y!==void 0&&(t=e),this.show(void 0,t)}))}_setupPointerExitEventsIfNeeded(){if(!this._pointerExitEventsInitialized){if(this._pointerExitEventsInitialized=!0,!this._isTouchPlatform())this._addListener("mouseleave",e=>{let t=e.relatedTarget;(!t||!this._overlayRef?.overlayElement.contains(t))&&this.hide()}),this._addListener("wheel",e=>{if(this._isTooltipVisible()){let t=this._document.elementFromPoint(e.clientX,e.clientY),n=this._elementRef.nativeElement;t!==n&&!n.contains(t)&&this.hide()}});else if(this.touchGestures!=="off"){this._disableNativeGesturesIfNecessary();let e=()=>{this._touchstartTimeout&&clearTimeout(this._touchstartTimeout),this.hide(this._defaultOptions?.touchendHideDelay)};this._addListener("touchend",e),this._addListener("touchcancel",e)}}}_addListener(e,t){this._eventCleanups.push(this._renderer.listen(this._elementRef.nativeElement,e,t,rr))}_isTouchPlatform(){let e=this._defaultOptions?.detectHoverCapability;return typeof e=="function"?!e():this._platform.IOS||this._platform.ANDROID?!0:this._platform.isBrowser?!!e&&this._mediaMatcher.matchMedia("(any-hover: none)").matches:!1}_disableNativeGesturesIfNecessary(){let e=this.touchGestures;if(e!=="off"){let t=this._elementRef.nativeElement,n=t.style;(e==="on"||t.nodeName!=="INPUT"&&t.nodeName!=="TEXTAREA")&&(n.userSelect=n.msUserSelect=n.webkitUserSelect=n.MozUserSelect="none"),(e==="on"||!t.draggable)&&(n.webkitUserDrag="none"),n.touchAction="none",n.webkitTapHighlightColor="transparent"}}_syncAriaDescription(e){this._ariaDescriptionPending||(this._ariaDescriptionPending=!0,this._ariaDescriber.removeDescription(this._elementRef.nativeElement,e,"tooltip"),this._isDestroyed||ye({write:()=>{this._ariaDescriptionPending=!1,this.message&&!this.disabled&&this._ariaDescriber.describe(this._elementRef.nativeElement,this.message,"tooltip")}},{injector:this._injector}))}_overlayEventPredicate=e=>e.type==="keydown"?this._isTooltipVisible()&&e.keyCode===27&&!pe(e):!0;static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["","matTooltip",""]],hostAttrs:[1,"mat-mdc-tooltip-trigger"],hostVars:2,hostBindings:function(t,n){t&2&&D("mat-mdc-tooltip-disabled",n.disabled)},inputs:{position:[0,"matTooltipPosition","position"],positionAtOrigin:[0,"matTooltipPositionAtOrigin","positionAtOrigin"],disabled:[0,"matTooltipDisabled","disabled"],showDelay:[0,"matTooltipShowDelay","showDelay"],hideDelay:[0,"matTooltipHideDelay","hideDelay"],touchGestures:[0,"matTooltipTouchGestures","touchGestures"],message:[0,"matTooltip","message"],tooltipClass:[0,"matTooltipClass","tooltipClass"]},exportAs:["matTooltip"]})}return i})(),pr=(()=>{class i{_changeDetectorRef=s(ee);_elementRef=s(A);_isMultiline=!1;message;tooltipClass;_showTimeoutId;_hideTimeoutId;_triggerElement;_mouseLeaveHideDelay;_animationsDisabled=we();_tooltip;_closeOnInteraction=!1;_isVisible=!1;_onHide=new O;_showAnimation="mat-mdc-tooltip-show";_hideAnimation="mat-mdc-tooltip-hide";constructor(){}show(e){this._hideTimeoutId!=null&&clearTimeout(this._hideTimeoutId),this._showTimeoutId=setTimeout(()=>{this._toggleVisibility(!0),this._showTimeoutId=void 0},e)}hide(e){this._showTimeoutId!=null&&clearTimeout(this._showTimeoutId),this._hideTimeoutId=setTimeout(()=>{this._toggleVisibility(!1),this._hideTimeoutId=void 0},e)}afterHidden(){return this._onHide}isVisible(){return this._isVisible}ngOnDestroy(){this._cancelPendingAnimations(),this._onHide.complete(),this._triggerElement=null}_handleBodyInteraction(){this._closeOnInteraction&&this.hide(0)}_markForCheck(){this._changeDetectorRef.markForCheck()}_handleMouseLeave({relatedTarget:e}){(!e||!this._triggerElement.contains(e))&&(this.isVisible()?this.hide(this._mouseLeaveHideDelay):this._finalizeAnimation(!1))}_onShow(){this._isMultiline=this._isTooltipMultiline(),this._markForCheck()}_isTooltipMultiline(){let e=this._elementRef.nativeElement.getBoundingClientRect();return e.height>dr&&e.width>=cr}_handleAnimationEnd({animationName:e}){(e===this._showAnimation||e===this._hideAnimation)&&this._finalizeAnimation(e===this._showAnimation)}_cancelPendingAnimations(){this._showTimeoutId!=null&&clearTimeout(this._showTimeoutId),this._hideTimeoutId!=null&&clearTimeout(this._hideTimeoutId),this._showTimeoutId=this._hideTimeoutId=void 0}_finalizeAnimation(e){e?this._closeOnInteraction=!0:this.isVisible()||this._onHide.next()}_toggleVisibility(e){let t=this._tooltip.nativeElement,n=this._showAnimation,o=this._hideAnimation;if(t.classList.remove(e?o:n),t.classList.add(e?n:o),this._isVisible!==e&&(this._isVisible=e,this._changeDetectorRef.markForCheck()),e&&!this._animationsDisabled&&typeof getComputedStyle=="function"){let r=getComputedStyle(t);(r.getPropertyValue("animation-duration")==="0s"||r.getPropertyValue("animation-name")==="none")&&(this._animationsDisabled=!0)}e&&this._onShow(),this._animationsDisabled&&(t.classList.add("_mat-animation-noopable"),this._finalizeAnimation(e))}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-tooltip-component"]],viewQuery:function(t,n){if(t&1&&_e(nr,7),t&2){let o;F(o=L())&&(n._tooltip=o.first)}},hostAttrs:["aria-hidden","true"],hostBindings:function(t,n){t&1&&f("mouseleave",function(r){return n._handleMouseLeave(r)})},decls:4,vars:5,consts:[["tooltip",""],[1,"mdc-tooltip","mat-mdc-tooltip",3,"animationend"],[1,"mat-mdc-tooltip-surface","mdc-tooltip__surface"]],template:function(t,n){t&1&&(G(0,"div",1,0),Nt("animationend",function(r){return n._handleAnimationEnd(r)}),G(2,"div",2),_(3),J()()),t&2&&(We(n.tooltipClass),D("mdc-tooltip--multiline",n._isMultiline),l(3),k(n.message))},styles:[`.mat-mdc-tooltip {
  position: relative;
  transform: scale(0);
  display: inline-flex;
}
.mat-mdc-tooltip::before {
  content: "";
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: -1;
  position: absolute;
}
.mat-mdc-tooltip-panel-below .mat-mdc-tooltip::before {
  top: -8px;
}
.mat-mdc-tooltip-panel-above .mat-mdc-tooltip::before {
  bottom: -8px;
}
.mat-mdc-tooltip-panel-right .mat-mdc-tooltip::before {
  left: -8px;
}
.mat-mdc-tooltip-panel-left .mat-mdc-tooltip::before {
  right: -8px;
}
.mat-mdc-tooltip._mat-animation-noopable {
  animation: none;
  transform: scale(1);
}

.mat-mdc-tooltip-surface {
  word-break: normal;
  overflow-wrap: anywhere;
  padding: 4px 8px;
  min-width: 40px;
  max-width: 200px;
  min-height: 24px;
  max-height: 40vh;
  box-sizing: border-box;
  overflow: hidden;
  text-align: center;
  will-change: transform, opacity;
  background-color: var(--mat-tooltip-container-color, var(--mat-sys-inverse-surface));
  color: var(--mat-tooltip-supporting-text-color, var(--mat-sys-inverse-on-surface));
  border-radius: var(--mat-tooltip-container-shape, var(--mat-sys-corner-extra-small));
  font-family: var(--mat-tooltip-supporting-text-font, var(--mat-sys-body-small-font));
  font-size: var(--mat-tooltip-supporting-text-size, var(--mat-sys-body-small-size));
  font-weight: var(--mat-tooltip-supporting-text-weight, var(--mat-sys-body-small-weight));
  line-height: var(--mat-tooltip-supporting-text-line-height, var(--mat-sys-body-small-line-height));
  letter-spacing: var(--mat-tooltip-supporting-text-tracking, var(--mat-sys-body-small-tracking));
}
.mat-mdc-tooltip-surface::before {
  position: absolute;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  top: 0;
  left: 0;
  border: 1px solid transparent;
  border-radius: inherit;
  content: "";
  pointer-events: none;
}
.mdc-tooltip--multiline .mat-mdc-tooltip-surface {
  text-align: left;
}
[dir=rtl] .mdc-tooltip--multiline .mat-mdc-tooltip-surface {
  text-align: right;
}

.mat-mdc-tooltip-panel {
  line-height: normal;
}
.mat-mdc-tooltip-panel.mat-mdc-tooltip-panel-non-interactive {
  pointer-events: none;
}

@keyframes mat-mdc-tooltip-show {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes mat-mdc-tooltip-hide {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
}
.mat-mdc-tooltip-show {
  animation: mat-mdc-tooltip-show 150ms cubic-bezier(0, 0, 0.2, 1) forwards;
}

.mat-mdc-tooltip-hide {
  animation: mat-mdc-tooltip-hide 75ms cubic-bezier(0.4, 0, 1, 1) forwards;
}
`],encapsulation:2,changeDetection:0})}return i})();var gt=new B("MAT_INPUT_VALUE_ACCESSOR");var ur=["mat-calendar-body",""];function hr(i,a){return this._trackRow(a)}var ja=(i,a)=>a.id;function fr(i,a){if(i&1&&(G(0,"tr",0)(1,"td",3),_(2),J()()),i&2){let e=d();l(),tt("padding-top",e._cellPadding)("padding-bottom",e._cellPadding),w("colspan",e.numCols),l(),Se(" ",e.label," ")}}function _r(i,a){if(i&1&&(G(0,"td",3),_(1),J()),i&2){let e=d(2);tt("padding-top",e._cellPadding)("padding-bottom",e._cellPadding),w("colspan",e._firstRowOffset),l(),Se(" ",e._firstRowOffset>=e.labelMinRequiredCells?e.label:""," ")}}function gr(i,a){if(i&1){let e=R();G(0,"td",6)(1,"button",7),Nt("click",function(n){let o=u(e).$implicit,r=d(2);return h(r._cellClicked(o,n))})("focus",function(n){let o=u(e).$implicit,r=d(2);return h(r._emitActiveDateChange(o,n))}),G(2,"span",8),_(3),J(),xe(4,"span",9),J()()}if(i&2){let e=a.$implicit,t=a.$index,n=d().$index,o=d();tt("width",o._cellWidth)("padding-top",o._cellPadding)("padding-bottom",o._cellPadding),w("data-mat-row",n)("data-mat-col",t),l(),We(e.cssClasses),D("mat-calendar-body-disabled",!e.enabled)("mat-calendar-body-active",o._isActiveCell(n,t))("mat-calendar-body-range-start",o._isRangeStart(e.compareValue))("mat-calendar-body-range-end",o._isRangeEnd(e.compareValue))("mat-calendar-body-in-range",o._isInRange(e.compareValue))("mat-calendar-body-comparison-bridge-start",o._isComparisonBridgeStart(e.compareValue,n,t))("mat-calendar-body-comparison-bridge-end",o._isComparisonBridgeEnd(e.compareValue,n,t))("mat-calendar-body-comparison-start",o._isComparisonStart(e.compareValue))("mat-calendar-body-comparison-end",o._isComparisonEnd(e.compareValue))("mat-calendar-body-in-comparison-range",o._isInComparisonRange(e.compareValue))("mat-calendar-body-preview-start",o._isPreviewStart(e.compareValue))("mat-calendar-body-preview-end",o._isPreviewEnd(e.compareValue))("mat-calendar-body-in-preview",o._isInPreview(e.compareValue)),se("tabIndex",o._isActiveCell(n,t)?0:-1),w("aria-label",e.ariaLabel)("aria-disabled",!e.enabled||null)("aria-pressed",o._isSelected(e.compareValue))("aria-current",o.todayValue===e.compareValue?"date":null)("aria-describedby",o._getDescribedby(e.compareValue)),l(),D("mat-calendar-body-selected",o._isSelected(e.compareValue))("mat-calendar-body-comparison-identical",o._isComparisonIdentical(e.compareValue))("mat-calendar-body-today",o.todayValue===e.compareValue),l(),Se(" ",e.displayValue," ")}}function br(i,a){if(i&1&&(G(0,"tr",1),v(1,_r,2,6,"td",4),ke(2,gr,5,49,"td",5,ja),J()),i&2){let e=a.$implicit,t=a.$index,n=d();l(),y(t===0&&n._firstRowOffset?1:-1),l(),Me(e)}}function vr(i,a){if(i&1&&(c(0,"th",2)(1,"span",6),_(2),p(),c(3,"span",3),_(4),p()()),i&2){let e=a.$implicit;l(2),k(e.long),l(2),k(e.narrow)}}var yr=["*"];function xr(i,a){}function Cr(i,a){if(i&1){let e=R();c(0,"mat-month-view",4),qt("activeDateChange",function(n){u(e);let o=d();return Wt(o.activeDate,n)||(o.activeDate=n),h(n)}),f("_userSelection",function(n){u(e);let o=d();return h(o._dateSelected(n))})("dragStarted",function(n){u(e);let o=d();return h(o._dragStarted(n))})("dragEnded",function(n){u(e);let o=d();return h(o._dragEnded(n))}),p()}if(i&2){let e=d();jt("activeDate",e.activeDate),b("selected",e.selected)("dateFilter",e.dateFilter)("maxDate",e.maxDate)("minDate",e.minDate)("dateClass",e.dateClass)("comparisonStart",e.comparisonStart)("comparisonEnd",e.comparisonEnd)("startDateAccessibleName",e.startDateAccessibleName)("endDateAccessibleName",e.endDateAccessibleName)("activeDrag",e._activeDrag)}}function wr(i,a){if(i&1){let e=R();c(0,"mat-year-view",5),qt("activeDateChange",function(n){u(e);let o=d();return Wt(o.activeDate,n)||(o.activeDate=n),h(n)}),f("monthSelected",function(n){u(e);let o=d();return h(o._monthSelectedInYearView(n))})("selectedChange",function(n){u(e);let o=d();return h(o._goToDateInView(n,"month"))}),p()}if(i&2){let e=d();jt("activeDate",e.activeDate),b("selected",e.selected)("dateFilter",e.dateFilter)("maxDate",e.maxDate)("minDate",e.minDate)("dateClass",e.dateClass)}}function Dr(i,a){if(i&1){let e=R();c(0,"mat-multi-year-view",6),qt("activeDateChange",function(n){u(e);let o=d();return Wt(o.activeDate,n)||(o.activeDate=n),h(n)}),f("yearSelected",function(n){u(e);let o=d();return h(o._yearSelectedInMultiYearView(n))})("selectedChange",function(n){u(e);let o=d();return h(o._goToDateInView(n,"year"))}),p()}if(i&2){let e=d();jt("activeDate",e.activeDate),b("selected",e.selected)("dateFilter",e.dateFilter)("maxDate",e.maxDate)("minDate",e.minDate)("dateClass",e.dateClass)}}function kr(i,a){}var Mr=["button"],Sr=[[["","matDatepickerToggleIcon",""]]],Er=["[matDatepickerToggleIcon]"];function Ar(i,a){i&1&&(et(),c(0,"svg",2),ne(1,"path",3),p())}var Pr=[[["input","matStartDate",""]],[["input","matEndDate",""]]],Tr=["input[matStartDate]","input[matEndDate]"];var wt=(()=>{class i{changes=new O;calendarLabel="Calendar";openCalendarLabel="Open calendar";closeCalendarLabel="Close calendar";prevMonthLabel="Previous month";nextMonthLabel="Next month";prevYearLabel="Previous year";nextYearLabel="Next year";prevMultiYearLabel="Previous 24 years";nextMultiYearLabel="Next 24 years";switchToMonthViewLabel="Choose date";switchToMultiYearViewLabel="Choose month and year";startDateLabel="Start date";endDateLabel="End date";comparisonDateLabel="Comparison range";formatYearRange(e,t){return`${e} \u2013 ${t}`}formatYearRangeLabel(e,t){return`${e} to ${t}`}static \u0275fac=function(t){return new(t||i)};static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})(),Or=0,Vt=class{value;displayValue;ariaLabel;enabled;compareValue;rawValue;id=Or++;cssClasses;constructor(a,e,t,n,o,r=a,m){this.value=a,this.displayValue=e,this.ariaLabel=t,this.enabled=n,this.compareValue=r,this.rawValue=m,this.cssClasses=o instanceof Set?Array.from(o):o}},Ir={passive:!1,capture:!0},kn={passive:!0,capture:!0},La={passive:!0},yt=(()=>{class i{_elementRef=s(A);_ngZone=s(V);_platform=s(te);_intl=s(wt);_eventCleanups;_skipNextFocus=!1;_focusActiveCellAfterViewChecked=!1;label;rows;todayValue;startValue;endValue;labelMinRequiredCells;numCols=7;activeCell=0;ngAfterViewChecked(){this._focusActiveCellAfterViewChecked&&(this._focusActiveCell(),this._focusActiveCellAfterViewChecked=!1)}isRange=!1;cellAspectRatio=1;comparisonStart=null;comparisonEnd=null;previewStart=null;previewEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;selectedValueChange=new M;previewChange=new M;activeDateChange=new M;dragStarted=new M;dragEnded=new M;_firstRowOffset;_cellPadding;_cellWidth;_startDateLabelId;_endDateLabelId;_comparisonStartDateLabelId;_comparisonEndDateLabelId;_didDragSinceMouseDown=!1;_injector=s(j);comparisonDateAccessibleName=this._intl.comparisonDateLabel;_trackRow=e=>e;constructor(){let e=s(Q),t=s(me);this._startDateLabelId=t.getId("mat-calendar-body-start-"),this._endDateLabelId=t.getId("mat-calendar-body-end-"),this._comparisonStartDateLabelId=t.getId("mat-calendar-body-comparison-start-"),this._comparisonEndDateLabelId=t.getId("mat-calendar-body-comparison-end-"),s(Ce).load(dn),this._ngZone.runOutsideAngular(()=>{let n=this._elementRef.nativeElement,o=[e.listen(n,"touchmove",this._touchmoveHandler,Ir),e.listen(n,"mouseenter",this._enterHandler,kn),e.listen(n,"focus",this._enterHandler,kn),e.listen(n,"mouseleave",this._leaveHandler,kn),e.listen(n,"blur",this._leaveHandler,kn),e.listen(n,"mousedown",this._mousedownHandler,La),e.listen(n,"touchstart",this._mousedownHandler,La)];this._platform.isBrowser&&o.push(e.listen("window","mouseup",this._mouseupHandler),e.listen("window","touchend",this._touchendHandler)),this._eventCleanups=o})}_cellClicked(e,t){this._didDragSinceMouseDown||e.enabled&&this.selectedValueChange.emit({value:e.value,event:t})}_emitActiveDateChange(e,t){e.enabled&&this.activeDateChange.emit({value:e.value,event:t})}_isSelected(e){return this.startValue===e||this.endValue===e}ngOnChanges(e){let t=e.numCols,{rows:n,numCols:o}=this;(e.rows||t)&&(this._firstRowOffset=n&&n.length&&n[0].length?o-n[0].length:0),(e.cellAspectRatio||t||!this._cellPadding)&&(this._cellPadding=`${50*this.cellAspectRatio/o}%`),(t||!this._cellWidth)&&(this._cellWidth=`${100/o}%`)}ngOnDestroy(){this._eventCleanups.forEach(e=>e())}_isActiveCell(e,t){let n=e*this.numCols+t;return e&&(n-=this._firstRowOffset),n==this.activeCell}_focusActiveCell(e=!0){ye(()=>{setTimeout(()=>{let t=this._elementRef.nativeElement.querySelector(".mat-calendar-body-active");t&&(e||(this._skipNextFocus=!0),t.focus())})},{injector:this._injector})}_scheduleFocusActiveCellAfterViewChecked(){this._focusActiveCellAfterViewChecked=!0}_isRangeStart(e){return si(e,this.startValue,this.endValue)}_isRangeEnd(e){return li(e,this.startValue,this.endValue)}_isInRange(e){return di(e,this.startValue,this.endValue,this.isRange)}_isComparisonStart(e){return si(e,this.comparisonStart,this.comparisonEnd)}_isComparisonBridgeStart(e,t,n){if(!this._isComparisonStart(e)||this._isRangeStart(e)||!this._isInRange(e))return!1;let o=this.rows[t][n-1];if(!o){let r=this.rows[t-1];o=r&&r[r.length-1]}return o&&!this._isRangeEnd(o.compareValue)}_isComparisonBridgeEnd(e,t,n){if(!this._isComparisonEnd(e)||this._isRangeEnd(e)||!this._isInRange(e))return!1;let o=this.rows[t][n+1];if(!o){let r=this.rows[t+1];o=r&&r[0]}return o&&!this._isRangeStart(o.compareValue)}_isComparisonEnd(e){return li(e,this.comparisonStart,this.comparisonEnd)}_isInComparisonRange(e){return di(e,this.comparisonStart,this.comparisonEnd,this.isRange)}_isComparisonIdentical(e){return this.comparisonStart===this.comparisonEnd&&e===this.comparisonStart}_isPreviewStart(e){return si(e,this.previewStart,this.previewEnd)}_isPreviewEnd(e){return li(e,this.previewStart,this.previewEnd)}_isInPreview(e){return di(e,this.previewStart,this.previewEnd,this.isRange)}_getDescribedby(e){if(!this.isRange)return null;if(this.startValue===e&&this.endValue===e)return`${this._startDateLabelId} ${this._endDateLabelId}`;if(this.startValue===e)return this._startDateLabelId;if(this.endValue===e)return this._endDateLabelId;if(this.comparisonStart!==null&&this.comparisonEnd!==null){if(e===this.comparisonStart&&e===this.comparisonEnd)return`${this._comparisonStartDateLabelId} ${this._comparisonEndDateLabelId}`;if(e===this.comparisonStart)return this._comparisonStartDateLabelId;if(e===this.comparisonEnd)return this._comparisonEndDateLabelId}return null}_enterHandler=e=>{if(this._skipNextFocus&&e.type==="focus"){this._skipNextFocus=!1;return}if(e.target&&this.isRange){let t=this._getCellFromElement(e.target);t&&this._ngZone.run(()=>this.previewChange.emit({value:t.enabled?t:null,event:e}))}};_touchmoveHandler=e=>{if(!this.isRange)return;let t=Ba(e),n=t?this._getCellFromElement(t):null;t!==e.target&&(this._didDragSinceMouseDown=!0),ri(e.target)&&e.preventDefault(),this._ngZone.run(()=>this.previewChange.emit({value:n?.enabled?n:null,event:e}))};_leaveHandler=e=>{this.previewEnd!==null&&this.isRange&&(e.type!=="blur"&&(this._didDragSinceMouseDown=!0),e.target&&this._getCellFromElement(e.target)&&!(e.relatedTarget&&this._getCellFromElement(e.relatedTarget))&&this._ngZone.run(()=>this.previewChange.emit({value:null,event:e})))};_mousedownHandler=e=>{if(!this.isRange)return;this._didDragSinceMouseDown=!1;let t=e.target&&this._getCellFromElement(e.target);!t||!this._isInRange(t.compareValue)||this._ngZone.run(()=>{this.dragStarted.emit({value:t.rawValue,event:e})})};_mouseupHandler=e=>{if(!this.isRange)return;let t=ri(e.target);if(!t){this._ngZone.run(()=>{this.dragEnded.emit({value:null,event:e})});return}t.closest(".mat-calendar-body")===this._elementRef.nativeElement&&this._ngZone.run(()=>{let n=this._getCellFromElement(t);this.dragEnded.emit({value:n?.rawValue??null,event:e})})};_touchendHandler=e=>{let t=Ba(e);t&&this._mouseupHandler({target:t})};_getCellFromElement(e){let t=ri(e);if(t){let n=t.getAttribute("data-mat-row"),o=t.getAttribute("data-mat-col");if(n&&o)return this.rows[parseInt(n)]?.[parseInt(o)]||null}return null}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["","mat-calendar-body",""]],hostAttrs:[1,"mat-calendar-body"],inputs:{label:"label",rows:"rows",todayValue:"todayValue",startValue:"startValue",endValue:"endValue",labelMinRequiredCells:"labelMinRequiredCells",numCols:"numCols",activeCell:"activeCell",isRange:"isRange",cellAspectRatio:"cellAspectRatio",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd",previewStart:"previewStart",previewEnd:"previewEnd",startDateAccessibleName:"startDateAccessibleName",endDateAccessibleName:"endDateAccessibleName"},outputs:{selectedValueChange:"selectedValueChange",previewChange:"previewChange",activeDateChange:"activeDateChange",dragStarted:"dragStarted",dragEnded:"dragEnded"},exportAs:["matCalendarBody"],features:[fe],attrs:ur,decls:11,vars:11,consts:[["aria-hidden","true"],["role","row"],[1,"mat-calendar-body-hidden-label",3,"id"],[1,"mat-calendar-body-label"],[1,"mat-calendar-body-label",3,"paddingTop","paddingBottom"],["role","gridcell",1,"mat-calendar-body-cell-container",3,"width","paddingTop","paddingBottom"],["role","gridcell",1,"mat-calendar-body-cell-container"],["type","button",1,"mat-calendar-body-cell",3,"click","focus","tabindex"],[1,"mat-calendar-body-cell-content","mat-focus-indicator"],["aria-hidden","true",1,"mat-calendar-body-cell-preview"]],template:function(t,n){t&1&&(v(0,fr,3,6,"tr",0),ke(1,br,4,1,"tr",1,hr,!0),G(3,"span",2),_(4),J(),G(5,"span",2),_(6),J(),G(7,"span",2),_(8),J(),G(9,"span",2),_(10),J()),t&2&&(y(n._firstRowOffset<n.labelMinRequiredCells?0:-1),l(),Me(n.rows),l(2),se("id",n._startDateLabelId),l(),Se(" ",n.startDateAccessibleName,`
`),l(),se("id",n._endDateLabelId),l(),Se(" ",n.endDateAccessibleName,`
`),l(),se("id",n._comparisonStartDateLabelId),l(),zn(" ",n.comparisonDateAccessibleName," ",n.startDateAccessibleName,`
`),l(),se("id",n._comparisonEndDateLabelId),l(),zn(" ",n.comparisonDateAccessibleName," ",n.endDateAccessibleName,`
`))},styles:[`.mat-calendar-body {
  min-width: 224px;
}

.mat-calendar-body-today:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical) {
  border-color: var(--mat-datepicker-calendar-date-today-outline-color, var(--mat-sys-primary));
}

.mat-calendar-body-label {
  height: 0;
  line-height: 0;
  text-align: start;
  padding-left: 4.7142857143%;
  padding-right: 4.7142857143%;
  font-size: var(--mat-datepicker-calendar-body-label-text-size, var(--mat-sys-title-small-size));
  font-weight: var(--mat-datepicker-calendar-body-label-text-weight, var(--mat-sys-title-small-weight));
  color: var(--mat-datepicker-calendar-body-label-text-color, var(--mat-sys-on-surface));
}

.mat-calendar-body-hidden-label {
  display: none;
}

.mat-calendar-body-cell-container {
  position: relative;
  height: 0;
  line-height: 0;
}

.mat-calendar-body-cell {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: none;
  text-align: center;
  outline: none;
  margin: 0;
  font-family: var(--mat-datepicker-calendar-text-font, var(--mat-sys-body-medium-font));
  font-size: var(--mat-datepicker-calendar-text-size, var(--mat-sys-body-medium-size));
  -webkit-user-select: none;
  user-select: none;
  cursor: pointer;
  outline: none;
  border: none;
  -webkit-tap-highlight-color: transparent;
}
.mat-calendar-body-cell::-moz-focus-inner {
  border: 0;
}

.mat-calendar-body-cell::before,
.mat-calendar-body-cell::after,
.mat-calendar-body-cell-preview {
  content: "";
  position: absolute;
  top: 5%;
  left: 0;
  z-index: 0;
  box-sizing: border-box;
  display: block;
  height: 90%;
  width: 100%;
}

.mat-calendar-body-range-start:not(.mat-calendar-body-in-comparison-range)::before,
.mat-calendar-body-range-start::after,
.mat-calendar-body-comparison-start:not(.mat-calendar-body-comparison-bridge-start)::before,
.mat-calendar-body-comparison-start::after,
.mat-calendar-body-preview-start .mat-calendar-body-cell-preview {
  left: 5%;
  width: 95%;
  border-top-left-radius: 999px;
  border-bottom-left-radius: 999px;
}
[dir=rtl] .mat-calendar-body-range-start:not(.mat-calendar-body-in-comparison-range)::before,
[dir=rtl] .mat-calendar-body-range-start::after,
[dir=rtl] .mat-calendar-body-comparison-start:not(.mat-calendar-body-comparison-bridge-start)::before,
[dir=rtl] .mat-calendar-body-comparison-start::after,
[dir=rtl] .mat-calendar-body-preview-start .mat-calendar-body-cell-preview {
  left: 0;
  border-radius: 0;
  border-top-right-radius: 999px;
  border-bottom-right-radius: 999px;
}

.mat-calendar-body-range-end:not(.mat-calendar-body-in-comparison-range)::before,
.mat-calendar-body-range-end::after,
.mat-calendar-body-comparison-end:not(.mat-calendar-body-comparison-bridge-end)::before,
.mat-calendar-body-comparison-end::after,
.mat-calendar-body-preview-end .mat-calendar-body-cell-preview {
  width: 95%;
  border-top-right-radius: 999px;
  border-bottom-right-radius: 999px;
}
[dir=rtl] .mat-calendar-body-range-end:not(.mat-calendar-body-in-comparison-range)::before,
[dir=rtl] .mat-calendar-body-range-end::after,
[dir=rtl] .mat-calendar-body-comparison-end:not(.mat-calendar-body-comparison-bridge-end)::before,
[dir=rtl] .mat-calendar-body-comparison-end::after,
[dir=rtl] .mat-calendar-body-preview-end .mat-calendar-body-cell-preview {
  left: 5%;
  border-radius: 0;
  border-top-left-radius: 999px;
  border-bottom-left-radius: 999px;
}

[dir=rtl] .mat-calendar-body-comparison-bridge-start.mat-calendar-body-range-end::after,
[dir=rtl] .mat-calendar-body-comparison-bridge-end.mat-calendar-body-range-start::after {
  width: 95%;
  border-top-right-radius: 999px;
  border-bottom-right-radius: 999px;
}

.mat-calendar-body-comparison-start.mat-calendar-body-range-end::after, [dir=rtl] .mat-calendar-body-comparison-start.mat-calendar-body-range-end::after,
.mat-calendar-body-comparison-end.mat-calendar-body-range-start::after,
[dir=rtl] .mat-calendar-body-comparison-end.mat-calendar-body-range-start::after {
  width: 90%;
}

.mat-calendar-body-in-preview {
  color: var(--mat-datepicker-calendar-date-preview-state-outline-color, var(--mat-sys-primary));
}
.mat-calendar-body-in-preview .mat-calendar-body-cell-preview {
  border-top: dashed 1px;
  border-bottom: dashed 1px;
}

.mat-calendar-body-preview-start .mat-calendar-body-cell-preview {
  border-left: dashed 1px;
}
[dir=rtl] .mat-calendar-body-preview-start .mat-calendar-body-cell-preview {
  border-left: 0;
  border-right: dashed 1px;
}

.mat-calendar-body-preview-end .mat-calendar-body-cell-preview {
  border-right: dashed 1px;
}
[dir=rtl] .mat-calendar-body-preview-end .mat-calendar-body-cell-preview {
  border-right: 0;
  border-left: dashed 1px;
}

.mat-calendar-body-disabled {
  cursor: default;
}
.mat-calendar-body-disabled > .mat-calendar-body-cell-content:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical) {
  color: var(--mat-datepicker-calendar-date-disabled-state-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-calendar-body-disabled > .mat-calendar-body-today:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical) {
  border-color: var(--mat-datepicker-calendar-date-today-disabled-state-outline-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
@media (forced-colors: active) {
  .mat-calendar-body-disabled {
    opacity: 0.5;
  }
}

.mat-calendar-body-cell-content {
  top: 5%;
  left: 5%;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 90%;
  height: 90%;
  line-height: 1;
  border-width: 1px;
  border-style: solid;
  border-radius: 999px;
  color: var(--mat-datepicker-calendar-date-text-color, var(--mat-sys-on-surface));
  border-color: var(--mat-datepicker-calendar-date-outline-color, transparent);
}
.mat-calendar-body-cell-content.mat-focus-indicator {
  position: absolute;
}
@media (forced-colors: active) {
  .mat-calendar-body-cell-content {
    border: none;
  }
}

.cdk-keyboard-focused .mat-calendar-body-active > .mat-calendar-body-cell-content:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical), .cdk-program-focused .mat-calendar-body-active > .mat-calendar-body-cell-content:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical) {
  background-color: var(--mat-datepicker-calendar-date-focus-state-background-color, color-mix(in srgb, var(--mat-sys-on-surface) calc(var(--mat-sys-focus-state-layer-opacity) * 100%), transparent));
}

@media (hover: hover) {
  .mat-calendar-body-cell:not(.mat-calendar-body-disabled):hover > .mat-calendar-body-cell-content:not(.mat-calendar-body-selected):not(.mat-calendar-body-comparison-identical) {
    background-color: var(--mat-datepicker-calendar-date-hover-state-background-color, color-mix(in srgb, var(--mat-sys-on-surface) calc(var(--mat-sys-hover-state-layer-opacity) * 100%), transparent));
  }
}
.mat-calendar-body-selected {
  background-color: var(--mat-datepicker-calendar-date-selected-state-background-color, var(--mat-sys-primary));
  color: var(--mat-datepicker-calendar-date-selected-state-text-color, var(--mat-sys-on-primary));
}
.mat-calendar-body-disabled > .mat-calendar-body-selected {
  background-color: var(--mat-datepicker-calendar-date-selected-disabled-state-background-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-calendar-body-selected.mat-calendar-body-today {
  box-shadow: inset 0 0 0 1px var(--mat-datepicker-calendar-date-today-selected-state-outline-color, var(--mat-sys-primary));
}

.mat-calendar-body-in-range::before {
  background: var(--mat-datepicker-calendar-date-in-range-state-background-color, var(--mat-sys-primary-container));
}

.mat-calendar-body-comparison-identical,
.mat-calendar-body-in-comparison-range::before {
  background: var(--mat-datepicker-calendar-date-in-comparison-range-state-background-color, var(--mat-sys-tertiary-container));
}

.mat-calendar-body-comparison-identical,
.mat-calendar-body-in-comparison-range::before {
  background: var(--mat-datepicker-calendar-date-in-comparison-range-state-background-color, var(--mat-sys-tertiary-container));
}

.mat-calendar-body-comparison-bridge-start::before,
[dir=rtl] .mat-calendar-body-comparison-bridge-end::before {
  background: linear-gradient(to right, var(--mat-datepicker-calendar-date-in-range-state-background-color, var(--mat-sys-primary-container)) 50%, var(--mat-datepicker-calendar-date-in-comparison-range-state-background-color, var(--mat-sys-tertiary-container)) 50%);
}

.mat-calendar-body-comparison-bridge-end::before,
[dir=rtl] .mat-calendar-body-comparison-bridge-start::before {
  background: linear-gradient(to left, var(--mat-datepicker-calendar-date-in-range-state-background-color, var(--mat-sys-primary-container)) 50%, var(--mat-datepicker-calendar-date-in-comparison-range-state-background-color, var(--mat-sys-tertiary-container)) 50%);
}

.mat-calendar-body-in-range > .mat-calendar-body-comparison-identical,
.mat-calendar-body-in-comparison-range.mat-calendar-body-in-range::after {
  background: var(--mat-datepicker-calendar-date-in-overlap-range-state-background-color, var(--mat-sys-secondary-container));
}

.mat-calendar-body-comparison-identical.mat-calendar-body-selected,
.mat-calendar-body-in-comparison-range > .mat-calendar-body-selected {
  background: var(--mat-datepicker-calendar-date-in-overlap-range-selected-state-background-color, var(--mat-sys-secondary));
}

@media (forced-colors: active) {
  .mat-datepicker-popup:not(:empty),
  .mat-calendar-body-cell:not(.mat-calendar-body-in-range) .mat-calendar-body-selected {
    outline: solid 1px;
  }
  .mat-calendar-body-today {
    outline: dotted 1px;
  }
  .mat-calendar-body-cell::before,
  .mat-calendar-body-cell::after,
  .mat-calendar-body-selected {
    background: none;
  }
  .mat-calendar-body-in-range::before,
  .mat-calendar-body-comparison-bridge-start::before,
  .mat-calendar-body-comparison-bridge-end::before {
    border-top: solid 1px;
    border-bottom: solid 1px;
  }
  .mat-calendar-body-range-start::before {
    border-left: solid 1px;
  }
  [dir=rtl] .mat-calendar-body-range-start::before {
    border-left: 0;
    border-right: solid 1px;
  }
  .mat-calendar-body-range-end::before {
    border-right: solid 1px;
  }
  [dir=rtl] .mat-calendar-body-range-end::before {
    border-right: 0;
    border-left: solid 1px;
  }
  .mat-calendar-body-in-comparison-range::before {
    border-top: dashed 1px;
    border-bottom: dashed 1px;
  }
  .mat-calendar-body-comparison-start::before {
    border-left: dashed 1px;
  }
  [dir=rtl] .mat-calendar-body-comparison-start::before {
    border-left: 0;
    border-right: dashed 1px;
  }
  .mat-calendar-body-comparison-end::before {
    border-right: dashed 1px;
  }
  [dir=rtl] .mat-calendar-body-comparison-end::before {
    border-right: 0;
    border-left: dashed 1px;
  }
}
`],encapsulation:2,changeDetection:0})}return i})();function oi(i){return i?.nodeName==="TD"}function ri(i){let a;return oi(i)?a=i:oi(i.parentNode)?a=i.parentNode:oi(i.parentNode?.parentNode)&&(a=i.parentNode.parentNode),a?.getAttribute("data-mat-row")!=null?a:null}function si(i,a,e){return e!==null&&a!==e&&i<e&&i===a}function li(i,a,e){return a!==null&&a!==e&&i>=a&&i===e}function di(i,a,e,t){return t&&a!==null&&e!==null&&a!==e&&i>=a&&i<=e}function Ba(i){let a=i.changedTouches[0];return document.elementFromPoint(a.clientX,a.clientY)}var K=class{start;end;_disableStructuralEquivalency;constructor(a,e){this.start=a,this.end=e}},Ze=(()=>{class i{selection;_adapter;_selectionChanged=new O;selectionChanged=this._selectionChanged;constructor(e,t){this.selection=e,this._adapter=t,this.selection=e}updateSelection(e,t){let n=this.selection;this.selection=e,this._selectionChanged.next({selection:e,source:t,oldValue:n})}ngOnDestroy(){this._selectionChanged.complete()}_isValidDateInstance(e){return this._adapter.isDateInstance(e)&&this._adapter.isValid(e)}static \u0275fac=function(t){Si()};static \u0275prov=H({token:i,factory:i.\u0275fac})}return i})(),Rr=(()=>{class i extends Ze{constructor(e){super(null,e)}add(e){super.updateSelection(e,this)}isValid(){return this.selection!=null&&this._isValidDateInstance(this.selection)}isComplete(){return this.selection!=null}clone(){let e=new i(this._adapter);return e.updateSelection(this.selection,this),e}static \u0275fac=function(t){return new(t||i)(Bt(U))};static \u0275prov=H({token:i,factory:i.\u0275fac})}return i})(),Vr=(()=>{class i extends Ze{constructor(e){super(new K(null,null),e)}add(e){let{start:t,end:n}=this.selection;t==null?t=e:n==null?n=e:(t=e,n=null),super.updateSelection(new K(t,n),this)}isValid(){let{start:e,end:t}=this.selection;return e==null&&t==null?!0:e!=null&&t!=null?this._isValidDateInstance(e)&&this._isValidDateInstance(t)&&this._adapter.compareDate(e,t)<=0:(e==null||this._isValidDateInstance(e))&&(t==null||this._isValidDateInstance(t))}isComplete(){return this.selection.start!=null&&this.selection.end!=null}clone(){let e=new i(this._adapter);return e.updateSelection(this.selection,this),e}static \u0275fac=function(t){return new(t||i)(Bt(U))};static \u0275prov=H({token:i,factory:i.\u0275fac})}return i})(),Wa={provide:Ze,useFactory:()=>s(Ze,{optional:!0,skipSelf:!0})||new Rr(s(U))},Fr={provide:Ze,useFactory:()=>s(Ze,{optional:!0,skipSelf:!0})||new Vr(s(U))},Mn=new B("MAT_DATE_RANGE_SELECTION_STRATEGY"),Lr=(()=>{class i{_dateAdapter;constructor(e){this._dateAdapter=e}selectionFinished(e,t){let{start:n,end:o}=t;return n==null?n=e:o==null&&e&&this._dateAdapter.compareDate(e,n)>=0?o=e:(n=e,o=null),new K(n,o)}createPreview(e,t){let n=null,o=null;return t.start&&!t.end&&e&&(n=t.start,o=e),new K(n,o)}createDrag(e,t,n){let o=t.start,r=t.end;if(!o||!r)return null;let m=this._dateAdapter,g=m.compareDate(o,r)!==0,C=m.getYear(n)-m.getYear(e),x=m.getMonth(n)-m.getMonth(e),S=m.getDate(n)-m.getDate(e);return g&&m.sameDate(e,t.start)?(o=n,m.compareDate(n,r)>0&&(r=m.addCalendarYears(r,C),r=m.addCalendarMonths(r,x),r=m.addCalendarDays(r,S))):g&&m.sameDate(e,t.end)?(r=n,m.compareDate(n,o)<0&&(o=m.addCalendarYears(o,C),o=m.addCalendarMonths(o,x),o=m.addCalendarDays(o,S))):(o=m.addCalendarYears(o,C),o=m.addCalendarMonths(o,x),o=m.addCalendarDays(o,S),r=m.addCalendarYears(r,C),r=m.addCalendarMonths(r,x),r=m.addCalendarDays(r,S)),new K(o,r)}static \u0275fac=function(t){return new(t||i)(Bt(U))};static \u0275prov=H({token:i,factory:i.\u0275fac})}return i})(),ci=7,Br=0,za=(()=>{class i{_changeDetectorRef=s(ee);_dateFormats=s(Be,{optional:!0});_dateAdapter=s(U,{optional:!0});_dir=s(le,{optional:!0});_rangeStrategy=s(Mn,{optional:!0});_rerenderSubscription=N.EMPTY;_selectionKeyPressed=!1;get activeDate(){return this._activeDate}set activeDate(e){let t=this._activeDate,n=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))||this._dateAdapter.today();this._activeDate=this._dateAdapter.clampDate(n,this.minDate,this.maxDate),this._hasSameMonthAndYear(t,this._activeDate)||this._init()}_activeDate;get selected(){return this._selected}set selected(e){e instanceof K?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e)),this._setRanges(this._selected)}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;comparisonStart=null;comparisonEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;activeDrag=null;selectedChange=new M;_userSelection=new M;dragStarted=new M;dragEnded=new M;activeDateChange=new M;_matCalendarBody;_monthLabel=T("");_weeks=T([]);_firstWeekOffset=T(0);_rangeStart=T(null);_rangeEnd=T(null);_comparisonRangeStart=T(null);_comparisonRangeEnd=T(null);_previewStart=T(null);_previewEnd=T(null);_isRange=T(!1);_todayDate=T(null);_weekdays=T([]);constructor(){s(Ce).load(an),this._activeDate=this._dateAdapter.today()}ngAfterContentInit(){this._rerenderSubscription=this._dateAdapter.localeChanges.pipe(Je(null)).subscribe(()=>this._init())}ngOnChanges(e){let t=e.comparisonStart||e.comparisonEnd;t&&!t.firstChange&&this._setRanges(this.selected),e.activeDrag&&!this.activeDrag&&this._clearPreview()}ngOnDestroy(){this._rerenderSubscription.unsubscribe()}_dateSelected(e){let t=e.value,n=this._getDateFromDayOfMonth(t),o,r;this._selected instanceof K?(o=this._getDateInCurrentMonth(this._selected.start),r=this._getDateInCurrentMonth(this._selected.end)):o=r=this._getDateInCurrentMonth(this._selected),(o!==t||r!==t)&&this.selectedChange.emit(n),this._userSelection.emit({value:n,event:e.event}),this._clearPreview(),this._changeDetectorRef.markForCheck()}_updateActiveDate(e){let t=e.value,n=this._activeDate;this.activeDate=this._getDateFromDayOfMonth(t),this._dateAdapter.compareDate(n,this.activeDate)&&this.activeDateChange.emit(this._activeDate)}_handleCalendarBodyKeydown(e){let t=this._activeDate,n=this._isRtl();switch(e.keyCode){case 37:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,n?1:-1);break;case 39:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,n?-1:1);break;case 38:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,-7);break;case 40:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,7);break;case 36:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,1-this._dateAdapter.getDate(this._activeDate));break;case 35:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,this._dateAdapter.getNumDaysInMonth(this._activeDate)-this._dateAdapter.getDate(this._activeDate));break;case 33:this.activeDate=e.altKey?this._dateAdapter.addCalendarYears(this._activeDate,-1):this._dateAdapter.addCalendarMonths(this._activeDate,-1);break;case 34:this.activeDate=e.altKey?this._dateAdapter.addCalendarYears(this._activeDate,1):this._dateAdapter.addCalendarMonths(this._activeDate,1);break;case 13:case 32:this._selectionKeyPressed=!0,this._canSelect(this._activeDate)&&e.preventDefault();return;case 27:this._previewEnd()!=null&&!pe(e)&&(this._clearPreview(),this.activeDrag?this.dragEnded.emit({value:null,event:e}):(this.selectedChange.emit(null),this._userSelection.emit({value:null,event:e})),e.preventDefault(),e.stopPropagation());return;default:return}this._dateAdapter.compareDate(t,this.activeDate)&&(this.activeDateChange.emit(this.activeDate),this._focusActiveCellAfterViewChecked()),e.preventDefault()}_handleCalendarBodyKeyup(e){(e.keyCode===32||e.keyCode===13)&&(this._selectionKeyPressed&&this._canSelect(this._activeDate)&&this._dateSelected({value:this._dateAdapter.getDate(this._activeDate),event:e}),this._selectionKeyPressed=!1)}_init(){this._setRanges(this.selected),this._todayDate.set(this._getCellCompareValue(this._dateAdapter.today())),this._monthLabel.set(this._dateFormats.display.monthLabel?this._dateAdapter.format(this.activeDate,this._dateFormats.display.monthLabel):this._dateAdapter.getMonthNames("short")[this._dateAdapter.getMonth(this.activeDate)].toLocaleUpperCase());let e=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),this._dateAdapter.getMonth(this.activeDate),1);this._firstWeekOffset.set((ci+this._dateAdapter.getDayOfWeek(e)-this._dateAdapter.getFirstDayOfWeek())%ci),this._initWeekdays(),this._createWeekCells(),this._changeDetectorRef.markForCheck()}_focusActiveCell(e){this._matCalendarBody._focusActiveCell(e)}_focusActiveCellAfterViewChecked(){this._matCalendarBody._scheduleFocusActiveCellAfterViewChecked()}_previewChanged({event:e,value:t}){if(this._rangeStrategy){let n=t?t.rawValue:null,o=this._rangeStrategy.createPreview(n,this.selected,e);if(this._previewStart.set(this._getCellCompareValue(o.start)),this._previewEnd.set(this._getCellCompareValue(o.end)),this.activeDrag&&n){let r=this._rangeStrategy.createDrag?.(this.activeDrag.value,this.selected,n,e);r&&(this._previewStart.set(this._getCellCompareValue(r.start)),this._previewEnd.set(this._getCellCompareValue(r.end)))}}}_dragEnded(e){if(this.activeDrag)if(e.value){let t=this._rangeStrategy?.createDrag?.(this.activeDrag.value,this.selected,e.value,e.event);this.dragEnded.emit({value:t??null,event:e.event})}else this.dragEnded.emit({value:null,event:e.event})}_getDateFromDayOfMonth(e){return this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),this._dateAdapter.getMonth(this.activeDate),e)}_initWeekdays(){let e=this._dateAdapter.getFirstDayOfWeek(),t=this._dateAdapter.getDayOfWeekNames("narrow"),o=this._dateAdapter.getDayOfWeekNames("long").map((r,m)=>({long:r,narrow:t[m],id:Br++}));this._weekdays.set(o.slice(e).concat(o.slice(0,e)))}_createWeekCells(){let e=this._dateAdapter.getNumDaysInMonth(this.activeDate),t=this._dateAdapter.getDateNames(),n=[[]];for(let o=0,r=this._firstWeekOffset();o<e;o++,r++){r==ci&&(n.push([]),r=0);let m=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),this._dateAdapter.getMonth(this.activeDate),o+1),g=this._shouldEnableDate(m),C=this._dateAdapter.format(m,this._dateFormats.display.dateA11yLabel),x=this.dateClass?this.dateClass(m,"month"):void 0;n[n.length-1].push(new Vt(o+1,t[o],C,g,x,this._getCellCompareValue(m),m))}this._weeks.set(n)}_shouldEnableDate(e){return!!e&&(!this.minDate||this._dateAdapter.compareDate(e,this.minDate)>=0)&&(!this.maxDate||this._dateAdapter.compareDate(e,this.maxDate)<=0)&&(!this.dateFilter||this.dateFilter(e))}_getDateInCurrentMonth(e){return e&&this._hasSameMonthAndYear(e,this.activeDate)?this._dateAdapter.getDate(e):null}_hasSameMonthAndYear(e,t){return!!(e&&t&&this._dateAdapter.getMonth(e)==this._dateAdapter.getMonth(t)&&this._dateAdapter.getYear(e)==this._dateAdapter.getYear(t))}_getCellCompareValue(e){if(e){let t=this._dateAdapter.getYear(e),n=this._dateAdapter.getMonth(e),o=this._dateAdapter.getDate(e);return new Date(t,n,o).getTime()}return null}_isRtl(){return this._dir&&this._dir.value==="rtl"}_setRanges(e){e instanceof K?(this._rangeStart.set(this._getCellCompareValue(e.start)),this._rangeEnd.set(this._getCellCompareValue(e.end)),this._isRange.set(!0)):(this._rangeStart.set(this._getCellCompareValue(e)),this._rangeEnd.set(this._rangeStart()),this._isRange.set(!1)),this._comparisonRangeStart.set(this._getCellCompareValue(this.comparisonStart)),this._comparisonRangeEnd.set(this._getCellCompareValue(this.comparisonEnd))}_canSelect(e){return!this.dateFilter||this.dateFilter(e)}_clearPreview(){this._previewStart.set(null),this._previewEnd.set(null)}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-month-view"]],viewQuery:function(t,n){if(t&1&&_e(yt,5),t&2){let o;F(o=L())&&(n._matCalendarBody=o.first)}},inputs:{activeDate:"activeDate",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd",startDateAccessibleName:"startDateAccessibleName",endDateAccessibleName:"endDateAccessibleName",activeDrag:"activeDrag"},outputs:{selectedChange:"selectedChange",_userSelection:"_userSelection",dragStarted:"dragStarted",dragEnded:"dragEnded",activeDateChange:"activeDateChange"},exportAs:["matMonthView"],features:[fe],decls:8,vars:14,consts:[["role","grid",1,"mat-calendar-table"],[1,"mat-calendar-table-header"],["scope","col"],["aria-hidden","true"],["colspan","7",1,"mat-calendar-table-header-divider"],["mat-calendar-body","",3,"selectedValueChange","activeDateChange","previewChange","dragStarted","dragEnded","keyup","keydown","label","rows","todayValue","startValue","endValue","comparisonStart","comparisonEnd","previewStart","previewEnd","isRange","labelMinRequiredCells","activeCell","startDateAccessibleName","endDateAccessibleName"],[1,"cdk-visually-hidden"]],template:function(t,n){t&1&&(c(0,"table",0)(1,"thead",1)(2,"tr"),ke(3,vr,5,2,"th",2,ja),p(),c(5,"tr",3),ne(6,"th",4),p()(),c(7,"tbody",5),f("selectedValueChange",function(r){return n._dateSelected(r)})("activeDateChange",function(r){return n._updateActiveDate(r)})("previewChange",function(r){return n._previewChanged(r)})("dragStarted",function(r){return n.dragStarted.emit(r)})("dragEnded",function(r){return n._dragEnded(r)})("keyup",function(r){return n._handleCalendarBodyKeyup(r)})("keydown",function(r){return n._handleCalendarBodyKeydown(r)}),p()()),t&2&&(l(3),Me(n._weekdays()),l(4),b("label",n._monthLabel())("rows",n._weeks())("todayValue",n._todayDate())("startValue",n._rangeStart())("endValue",n._rangeEnd())("comparisonStart",n._comparisonRangeStart())("comparisonEnd",n._comparisonRangeEnd())("previewStart",n._previewStart())("previewEnd",n._previewEnd())("isRange",n._isRange())("labelMinRequiredCells",3)("activeCell",n._dateAdapter.getDate(n.activeDate)-1)("startDateAccessibleName",n.startDateAccessibleName)("endDateAccessibleName",n.endDateAccessibleName))},dependencies:[yt],encapsulation:2,changeDetection:0})}return i})(),be=24,pi=4,Na=(()=>{class i{_changeDetectorRef=s(ee);_dateAdapter=s(U,{optional:!0});_dir=s(le,{optional:!0});_rerenderSubscription=N.EMPTY;_selectionKeyPressed=!1;get activeDate(){return this._activeDate}set activeDate(e){let t=this._activeDate,n=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))||this._dateAdapter.today();this._activeDate=this._dateAdapter.clampDate(n,this.minDate,this.maxDate),qa(this._dateAdapter,t,this._activeDate,this.minDate,this.maxDate)||this._init()}_activeDate;get selected(){return this._selected}set selected(e){e instanceof K?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e)),this._setSelectedYear(e)}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;selectedChange=new M;yearSelected=new M;activeDateChange=new M;_matCalendarBody;_years=T([]);_todayYear=T(0);_selectedYear=T(null);constructor(){this._dateAdapter,this._activeDate=this._dateAdapter.today()}ngAfterContentInit(){this._rerenderSubscription=this._dateAdapter.localeChanges.pipe(Je(null)).subscribe(()=>this._init())}ngOnDestroy(){this._rerenderSubscription.unsubscribe()}_init(){this._todayYear.set(this._dateAdapter.getYear(this._dateAdapter.today()));let t=this._dateAdapter.getYear(this._activeDate)-Rt(this._dateAdapter,this.activeDate,this.minDate,this.maxDate),n=[];for(let o=0,r=[];o<be;o++)r.push(t+o),r.length==pi&&(n.push(r.map(m=>this._createCellForYear(m))),r=[]);this._years.set(n),this._changeDetectorRef.markForCheck()}_yearSelected(e){let t=e.value,n=this._dateAdapter.createDate(t,0,1),o=this._getDateFromYear(t);this.yearSelected.emit(n),this.selectedChange.emit(o)}_updateActiveDate(e){let t=e.value,n=this._activeDate;this.activeDate=this._getDateFromYear(t),this._dateAdapter.compareDate(n,this.activeDate)&&this.activeDateChange.emit(this.activeDate)}_handleCalendarBodyKeydown(e){let t=this._activeDate,n=this._isRtl();switch(e.keyCode){case 37:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,n?1:-1);break;case 39:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,n?-1:1);break;case 38:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,-pi);break;case 40:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,pi);break;case 36:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,-Rt(this._dateAdapter,this.activeDate,this.minDate,this.maxDate));break;case 35:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,be-Rt(this._dateAdapter,this.activeDate,this.minDate,this.maxDate)-1);break;case 33:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?-be*10:-be);break;case 34:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?be*10:be);break;case 13:case 32:this._selectionKeyPressed=!0;break;default:return}this._dateAdapter.compareDate(t,this.activeDate)&&this.activeDateChange.emit(this.activeDate),this._focusActiveCellAfterViewChecked(),e.preventDefault()}_handleCalendarBodyKeyup(e){(e.keyCode===32||e.keyCode===13)&&(this._selectionKeyPressed&&this._yearSelected({value:this._dateAdapter.getYear(this._activeDate),event:e}),this._selectionKeyPressed=!1)}_getActiveCell(){return Rt(this._dateAdapter,this.activeDate,this.minDate,this.maxDate)}_focusActiveCell(){this._matCalendarBody._focusActiveCell()}_focusActiveCellAfterViewChecked(){this._matCalendarBody._scheduleFocusActiveCellAfterViewChecked()}_getDateFromYear(e){let t=this._dateAdapter.getMonth(this.activeDate),n=this._dateAdapter.getNumDaysInMonth(this._dateAdapter.createDate(e,t,1));return this._dateAdapter.createDate(e,t,Math.min(this._dateAdapter.getDate(this.activeDate),n))}_createCellForYear(e){let t=this._dateAdapter.createDate(e,0,1),n=this._dateAdapter.getYearName(t),o=this.dateClass?this.dateClass(t,"multi-year"):void 0;return new Vt(e,n,n,this._shouldEnableYear(e),o)}_shouldEnableYear(e){if(e==null||this.maxDate&&e>this._dateAdapter.getYear(this.maxDate)||this.minDate&&e<this._dateAdapter.getYear(this.minDate))return!1;if(!this.dateFilter)return!0;let t=this._dateAdapter.createDate(e,0,1);for(let n=t;this._dateAdapter.getYear(n)==e;n=this._dateAdapter.addCalendarDays(n,1))if(this.dateFilter(n))return!0;return!1}_isRtl(){return this._dir&&this._dir.value==="rtl"}_setSelectedYear(e){if(this._selectedYear.set(null),e instanceof K){let t=e.start||e.end;t&&this._selectedYear.set(this._dateAdapter.getYear(t))}else e&&this._selectedYear.set(this._dateAdapter.getYear(e))}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-multi-year-view"]],viewQuery:function(t,n){if(t&1&&_e(yt,5),t&2){let o;F(o=L())&&(n._matCalendarBody=o.first)}},inputs:{activeDate:"activeDate",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass"},outputs:{selectedChange:"selectedChange",yearSelected:"yearSelected",activeDateChange:"activeDateChange"},exportAs:["matMultiYearView"],decls:5,vars:7,consts:[["role","grid",1,"mat-calendar-table"],["aria-hidden","true",1,"mat-calendar-table-header"],["colspan","4",1,"mat-calendar-table-header-divider"],["mat-calendar-body","",3,"selectedValueChange","activeDateChange","keyup","keydown","rows","todayValue","startValue","endValue","numCols","cellAspectRatio","activeCell"]],template:function(t,n){t&1&&(c(0,"table",0)(1,"thead",1)(2,"tr"),ne(3,"th",2),p()(),c(4,"tbody",3),f("selectedValueChange",function(r){return n._yearSelected(r)})("activeDateChange",function(r){return n._updateActiveDate(r)})("keyup",function(r){return n._handleCalendarBodyKeyup(r)})("keydown",function(r){return n._handleCalendarBodyKeydown(r)}),p()()),t&2&&(l(4),b("rows",n._years())("todayValue",n._todayYear())("startValue",n._selectedYear())("endValue",n._selectedYear())("numCols",4)("cellAspectRatio",4/7)("activeCell",n._getActiveCell()))},dependencies:[yt],encapsulation:2,changeDetection:0})}return i})();function qa(i,a,e,t,n){let o=i.getYear(a),r=i.getYear(e),m=$a(i,t,n);return Math.floor((o-m)/be)===Math.floor((r-m)/be)}function Rt(i,a,e,t){let n=i.getYear(a);return zr(n-$a(i,e,t),be)}function $a(i,a,e){let t=0;return e?t=i.getYear(e)-be+1:a&&(t=i.getYear(a)),t}function zr(i,a){return(i%a+a)%a}var Ha=(()=>{class i{_changeDetectorRef=s(ee);_dateFormats=s(Be,{optional:!0});_dateAdapter=s(U,{optional:!0});_dir=s(le,{optional:!0});_rerenderSubscription=N.EMPTY;_selectionKeyPressed=!1;get activeDate(){return this._activeDate}set activeDate(e){let t=this._activeDate,n=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))||this._dateAdapter.today();this._activeDate=this._dateAdapter.clampDate(n,this.minDate,this.maxDate),this._dateAdapter.getYear(t)!==this._dateAdapter.getYear(this._activeDate)&&this._init()}_activeDate;get selected(){return this._selected}set selected(e){e instanceof K?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e)),this._setSelectedMonth(e)}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;selectedChange=new M;monthSelected=new M;activeDateChange=new M;_matCalendarBody;_months=T([]);_yearLabel=T("");_todayMonth=T(null);_selectedMonth=T(null);constructor(){this._activeDate=this._dateAdapter.today()}ngAfterContentInit(){this._rerenderSubscription=this._dateAdapter.localeChanges.pipe(Je(null)).subscribe(()=>this._init())}ngOnDestroy(){this._rerenderSubscription.unsubscribe()}_monthSelected(e){let t=e.value,n=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),t,1);this.monthSelected.emit(n);let o=this._getDateFromMonth(t);this.selectedChange.emit(o)}_updateActiveDate(e){let t=e.value,n=this._activeDate;this.activeDate=this._getDateFromMonth(t),this._dateAdapter.compareDate(n,this.activeDate)&&this.activeDateChange.emit(this.activeDate)}_handleCalendarBodyKeydown(e){let t=this._activeDate,n=this._isRtl();switch(e.keyCode){case 37:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,n?1:-1);break;case 39:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,n?-1:1);break;case 38:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,-4);break;case 40:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,4);break;case 36:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,-this._dateAdapter.getMonth(this._activeDate));break;case 35:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,11-this._dateAdapter.getMonth(this._activeDate));break;case 33:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?-10:-1);break;case 34:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?10:1);break;case 13:case 32:this._selectionKeyPressed=!0;break;default:return}this._dateAdapter.compareDate(t,this.activeDate)&&(this.activeDateChange.emit(this.activeDate),this._focusActiveCellAfterViewChecked()),e.preventDefault()}_handleCalendarBodyKeyup(e){(e.keyCode===32||e.keyCode===13)&&(this._selectionKeyPressed&&this._monthSelected({value:this._dateAdapter.getMonth(this._activeDate),event:e}),this._selectionKeyPressed=!1)}_init(){this._setSelectedMonth(this.selected),this._todayMonth.set(this._getMonthInCurrentYear(this._dateAdapter.today())),this._yearLabel.set(this._dateAdapter.getYearName(this.activeDate));let e=this._dateAdapter.getMonthNames("short");this._months.set([[0,1,2,3],[4,5,6,7],[8,9,10,11]].map(t=>t.map(n=>this._createCellForMonth(n,e[n])))),this._changeDetectorRef.markForCheck()}_focusActiveCell(){this._matCalendarBody._focusActiveCell()}_focusActiveCellAfterViewChecked(){this._matCalendarBody._scheduleFocusActiveCellAfterViewChecked()}_getMonthInCurrentYear(e){return e&&this._dateAdapter.getYear(e)==this._dateAdapter.getYear(this.activeDate)?this._dateAdapter.getMonth(e):null}_getDateFromMonth(e){let t=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),e,1),n=this._dateAdapter.getNumDaysInMonth(t);return this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),e,Math.min(this._dateAdapter.getDate(this.activeDate),n))}_createCellForMonth(e,t){let n=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),e,1),o=this._dateAdapter.format(n,this._dateFormats.display.monthYearA11yLabel),r=this.dateClass?this.dateClass(n,"year"):void 0;return new Vt(e,t.toLocaleUpperCase(),o,this._shouldEnableMonth(e),r)}_shouldEnableMonth(e){let t=this._dateAdapter.getYear(this.activeDate);if(e==null||this._isYearAndMonthAfterMaxDate(t,e)||this._isYearAndMonthBeforeMinDate(t,e))return!1;if(!this.dateFilter)return!0;let n=this._dateAdapter.createDate(t,e,1);for(let o=n;this._dateAdapter.getMonth(o)==e;o=this._dateAdapter.addCalendarDays(o,1))if(this.dateFilter(o))return!0;return!1}_isYearAndMonthAfterMaxDate(e,t){if(this.maxDate){let n=this._dateAdapter.getYear(this.maxDate),o=this._dateAdapter.getMonth(this.maxDate);return e>n||e===n&&t>o}return!1}_isYearAndMonthBeforeMinDate(e,t){if(this.minDate){let n=this._dateAdapter.getYear(this.minDate),o=this._dateAdapter.getMonth(this.minDate);return e<n||e===n&&t<o}return!1}_isRtl(){return this._dir&&this._dir.value==="rtl"}_setSelectedMonth(e){e instanceof K?this._selectedMonth.set(this._getMonthInCurrentYear(e.start)||this._getMonthInCurrentYear(e.end)):this._selectedMonth.set(this._getMonthInCurrentYear(e))}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-year-view"]],viewQuery:function(t,n){if(t&1&&_e(yt,5),t&2){let o;F(o=L())&&(n._matCalendarBody=o.first)}},inputs:{activeDate:"activeDate",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass"},outputs:{selectedChange:"selectedChange",monthSelected:"monthSelected",activeDateChange:"activeDateChange"},exportAs:["matYearView"],decls:5,vars:9,consts:[["role","grid",1,"mat-calendar-table"],["aria-hidden","true",1,"mat-calendar-table-header"],["colspan","4",1,"mat-calendar-table-header-divider"],["mat-calendar-body","",3,"selectedValueChange","activeDateChange","keyup","keydown","label","rows","todayValue","startValue","endValue","labelMinRequiredCells","numCols","cellAspectRatio","activeCell"]],template:function(t,n){t&1&&(c(0,"table",0)(1,"thead",1)(2,"tr"),ne(3,"th",2),p()(),c(4,"tbody",3),f("selectedValueChange",function(r){return n._monthSelected(r)})("activeDateChange",function(r){return n._updateActiveDate(r)})("keyup",function(r){return n._handleCalendarBodyKeyup(r)})("keydown",function(r){return n._handleCalendarBodyKeydown(r)}),p()()),t&2&&(l(4),b("label",n._yearLabel())("rows",n._months())("todayValue",n._todayMonth())("startValue",n._selectedMonth())("endValue",n._selectedMonth())("labelMinRequiredCells",2)("numCols",4)("cellAspectRatio",4/7)("activeCell",n._dateAdapter.getMonth(n.activeDate)))},dependencies:[yt],encapsulation:2,changeDetection:0})}return i})(),Xa=(()=>{class i{_intl=s(wt);calendar=s(mi);_dateAdapter=s(U,{optional:!0});_dateFormats=s(Be,{optional:!0});_periodButtonText;_periodButtonDescription;_periodButtonLabel;_prevButtonLabel;_nextButtonLabel;constructor(){s(Ce).load(an);let e=s(ee);this._updateLabels(),this.calendar.stateChanges.subscribe(()=>{this._updateLabels(),e.markForCheck()})}get periodButtonText(){return this._periodButtonText}get periodButtonDescription(){return this._periodButtonDescription}get periodButtonLabel(){return this._periodButtonLabel}get prevButtonLabel(){return this._prevButtonLabel}get nextButtonLabel(){return this._nextButtonLabel}currentPeriodClicked(){this.calendar.currentView=this.calendar.currentView=="month"?"multi-year":"month"}previousClicked(){this.previousEnabled()&&(this.calendar.activeDate=this.calendar.currentView=="month"?this._dateAdapter.addCalendarMonths(this.calendar.activeDate,-1):this._dateAdapter.addCalendarYears(this.calendar.activeDate,this.calendar.currentView=="year"?-1:-be))}nextClicked(){this.nextEnabled()&&(this.calendar.activeDate=this.calendar.currentView=="month"?this._dateAdapter.addCalendarMonths(this.calendar.activeDate,1):this._dateAdapter.addCalendarYears(this.calendar.activeDate,this.calendar.currentView=="year"?1:be))}previousEnabled(){return this.calendar.minDate?!this.calendar.minDate||!this._isSameView(this.calendar.activeDate,this.calendar.minDate):!0}nextEnabled(){return!this.calendar.maxDate||!this._isSameView(this.calendar.activeDate,this.calendar.maxDate)}_updateLabels(){let e=this.calendar,t=this._intl,n=this._dateAdapter;e.currentView==="month"?(this._periodButtonText=n.format(e.activeDate,this._dateFormats.display.monthYearLabel).toLocaleUpperCase(),this._periodButtonDescription=n.format(e.activeDate,this._dateFormats.display.monthYearLabel).toLocaleUpperCase(),this._periodButtonLabel=t.switchToMultiYearViewLabel,this._prevButtonLabel=t.prevMonthLabel,this._nextButtonLabel=t.nextMonthLabel):e.currentView==="year"?(this._periodButtonText=n.getYearName(e.activeDate),this._periodButtonDescription=n.getYearName(e.activeDate),this._periodButtonLabel=t.switchToMonthViewLabel,this._prevButtonLabel=t.prevYearLabel,this._nextButtonLabel=t.nextYearLabel):(this._periodButtonText=t.formatYearRange(...this._formatMinAndMaxYearLabels()),this._periodButtonDescription=t.formatYearRangeLabel(...this._formatMinAndMaxYearLabels()),this._periodButtonLabel=t.switchToMonthViewLabel,this._prevButtonLabel=t.prevMultiYearLabel,this._nextButtonLabel=t.nextMultiYearLabel)}_isSameView(e,t){return this.calendar.currentView=="month"?this._dateAdapter.getYear(e)==this._dateAdapter.getYear(t)&&this._dateAdapter.getMonth(e)==this._dateAdapter.getMonth(t):this.calendar.currentView=="year"?this._dateAdapter.getYear(e)==this._dateAdapter.getYear(t):qa(this._dateAdapter,e,t,this.calendar.minDate,this.calendar.maxDate)}_formatMinAndMaxYearLabels(){let t=this._dateAdapter.getYear(this.calendar.activeDate)-Rt(this._dateAdapter,this.calendar.activeDate,this.calendar.minDate,this.calendar.maxDate),n=t+be-1,o=this._dateAdapter.getYearName(this._dateAdapter.createDate(t,0,1)),r=this._dateAdapter.getYearName(this._dateAdapter.createDate(n,0,1));return[o,r]}_periodButtonLabelId=s(me).getId("mat-calendar-period-label-");static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-calendar-header"]],exportAs:["matCalendarHeader"],ngContentSelectors:yr,decls:17,vars:13,consts:[[1,"mat-calendar-header"],[1,"mat-calendar-controls"],["aria-live","polite",1,"cdk-visually-hidden",3,"id"],["matButton","","type","button",1,"mat-calendar-period-button",3,"click"],["aria-hidden","true"],["viewBox","0 0 10 5","focusable","false","aria-hidden","true",1,"mat-calendar-arrow"],["points","0,0 5,5 10,0"],[1,"mat-calendar-spacer"],["matIconButton","","type","button","disabledInteractive","",1,"mat-calendar-previous-button",3,"click","disabled","matTooltip"],["viewBox","0 0 24 24","focusable","false","aria-hidden","true"],["d","M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"],["matIconButton","","type","button","disabledInteractive","",1,"mat-calendar-next-button",3,"click","disabled","matTooltip"],["d","M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"]],template:function(t,n){t&1&&(ie(),c(0,"div",0)(1,"div",1)(2,"span",2),_(3),p(),c(4,"button",3),f("click",function(){return n.currentPeriodClicked()}),c(5,"span",4),_(6),p(),et(),c(7,"svg",5),ne(8,"polygon",6),p()(),Fn(),ne(9,"div",7),z(10),c(11,"button",8),f("click",function(){return n.previousClicked()}),et(),c(12,"svg",9),ne(13,"path",10),p()(),Fn(),c(14,"button",11),f("click",function(){return n.nextClicked()}),et(),c(15,"svg",9),ne(16,"path",12),p()()()()),t&2&&(l(2),b("id",n._periodButtonLabelId),l(),k(n.periodButtonDescription),l(),w("aria-label",n.periodButtonLabel)("aria-describedby",n._periodButtonLabelId),l(2),k(n.periodButtonText),l(),D("mat-calendar-invert",n.calendar.currentView!=="month"),l(4),b("disabled",!n.previousEnabled())("matTooltip",n.prevButtonLabel),w("aria-label",n.prevButtonLabel),l(3),b("disabled",!n.nextEnabled())("matTooltip",n.nextButtonLabel),w("aria-label",n.nextButtonLabel))},dependencies:[qn,ut,Fa],encapsulation:2,changeDetection:0})}return i})(),mi=(()=>{class i{_dateAdapter=s(U,{optional:!0});_dateFormats=s(Be,{optional:!0});_changeDetectorRef=s(ee);_elementRef=s(A);headerComponent;_calendarHeaderPortal;_intlChanges;_moveFocusOnNextTick=!1;get startAt(){return this._startAt}set startAt(e){this._startAt=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_startAt=null;startView="month";get selected(){return this._selected}set selected(e){e instanceof K?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;comparisonStart=null;comparisonEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;selectedChange=new M;yearSelected=new M;monthSelected=new M;viewChanged=new M(!0);_userSelection=new M;_userDragDrop=new M;monthView;yearView;multiYearView;get activeDate(){return this._clampedActiveDate}set activeDate(e){this._clampedActiveDate=this._dateAdapter.clampDate(e,this.minDate,this.maxDate),this.stateChanges.next(),this._changeDetectorRef.markForCheck()}_clampedActiveDate;get currentView(){return this._currentView}set currentView(e){let t=this._currentView!==e?e:null;this._currentView=e,this._moveFocusOnNextTick=!0,this._changeDetectorRef.markForCheck(),t&&(this.stateChanges.next(),this.viewChanged.emit(t))}_currentView;_activeDrag=null;stateChanges=new O;constructor(){this._intlChanges=s(wt).changes.subscribe(()=>{this._changeDetectorRef.markForCheck(),this.stateChanges.next()})}ngAfterContentInit(){this._calendarHeaderPortal=new Xe(this.headerComponent||Xa),this.activeDate=this.startAt||this._dateAdapter.today(),this._currentView=this.startView}ngAfterViewChecked(){this._moveFocusOnNextTick&&(this._moveFocusOnNextTick=!1,this.focusActiveCell())}ngOnDestroy(){this._intlChanges.unsubscribe(),this.stateChanges.complete()}ngOnChanges(e){let t=e.minDate&&!this._dateAdapter.sameDate(e.minDate.previousValue,e.minDate.currentValue)?e.minDate:void 0,n=e.maxDate&&!this._dateAdapter.sameDate(e.maxDate.previousValue,e.maxDate.currentValue)?e.maxDate:void 0,o=t||n||e.dateFilter;if(o&&!o.firstChange){let r=this._getCurrentViewComponent();r&&(this._elementRef.nativeElement.contains(Et())&&(this._moveFocusOnNextTick=!0),this._changeDetectorRef.detectChanges(),r._init())}this.stateChanges.next()}focusActiveCell(){this._getCurrentViewComponent()?._focusActiveCell(!1)}updateTodaysDate(){this._getCurrentViewComponent()?._init()}_dateSelected(e){let t=e.value;(this.selected instanceof K||t&&!this._dateAdapter.sameDate(t,this.selected))&&this.selectedChange.emit(t),this._userSelection.emit(e)}_yearSelectedInMultiYearView(e){this.yearSelected.emit(e)}_monthSelectedInYearView(e){this.monthSelected.emit(e)}_goToDateInView(e,t){this.activeDate=e,this.currentView=t}_dragStarted(e){this._activeDrag=e}_dragEnded(e){this._activeDrag&&(e.value&&this._userDragDrop.emit(e),this._activeDrag=null)}_getCurrentViewComponent(){return this.monthView||this.yearView||this.multiYearView}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-calendar"]],viewQuery:function(t,n){if(t&1&&_e(za,5)(Ha,5)(Na,5),t&2){let o;F(o=L())&&(n.monthView=o.first),F(o=L())&&(n.yearView=o.first),F(o=L())&&(n.multiYearView=o.first)}},hostAttrs:[1,"mat-calendar"],inputs:{headerComponent:"headerComponent",startAt:"startAt",startView:"startView",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd",startDateAccessibleName:"startDateAccessibleName",endDateAccessibleName:"endDateAccessibleName"},outputs:{selectedChange:"selectedChange",yearSelected:"yearSelected",monthSelected:"monthSelected",viewChanged:"viewChanged",_userSelection:"_userSelection",_userDragDrop:"_userDragDrop"},exportAs:["matCalendar"],features:[X([Wa]),fe],decls:5,vars:2,consts:[[3,"cdkPortalOutlet"],["cdkMonitorSubtreeFocus","","tabindex","-1",1,"mat-calendar-content"],[3,"activeDate","selected","dateFilter","maxDate","minDate","dateClass","comparisonStart","comparisonEnd","startDateAccessibleName","endDateAccessibleName","activeDrag"],[3,"activeDate","selected","dateFilter","maxDate","minDate","dateClass"],[3,"activeDateChange","_userSelection","dragStarted","dragEnded","activeDate","selected","dateFilter","maxDate","minDate","dateClass","comparisonStart","comparisonEnd","startDateAccessibleName","endDateAccessibleName","activeDrag"],[3,"activeDateChange","monthSelected","selectedChange","activeDate","selected","dateFilter","maxDate","minDate","dateClass"],[3,"activeDateChange","yearSelected","selectedChange","activeDate","selected","dateFilter","maxDate","minDate","dateClass"]],template:function(t,n){if(t&1&&(Ve(0,xr,0,0,"ng-template",0),c(1,"div",1),v(2,Cr,1,11,"mat-month-view",2)(3,wr,1,6,"mat-year-view",3)(4,Dr,1,6,"mat-multi-year-view",3),p()),t&2){let o;b("cdkPortalOutlet",n._calendarHeaderPortal),l(2),y((o=n.currentView)==="month"?2:o==="year"?3:o==="multi-year"?4:-1)}},dependencies:[Qn,Hn,za,Ha,Na],styles:[`.mat-calendar {
  display: block;
  line-height: normal;
  font-family: var(--mat-datepicker-calendar-text-font, var(--mat-sys-body-medium-font));
  font-size: var(--mat-datepicker-calendar-text-size, var(--mat-sys-body-medium-size));
}

.mat-calendar-header {
  padding: 8px 8px 0 8px;
}

.mat-calendar-content {
  padding: 0 8px 8px 8px;
  outline: none;
}

.mat-calendar-controls {
  display: flex;
  align-items: center;
  margin: 5% calc(4.7142857143% - 16px);
}

.mat-calendar-spacer {
  flex: 1 1 auto;
}

.mat-calendar-period-button {
  min-width: 0;
  margin: 0 8px;
  font-size: var(--mat-datepicker-calendar-period-button-text-size, var(--mat-sys-title-small-size));
  font-weight: var(--mat-datepicker-calendar-period-button-text-weight, var(--mat-sys-title-small-weight));
  --mat-button-text-label-text-color: var(--mat-datepicker-calendar-period-button-text-color, var(--mat-sys-on-surface-variant));
}

.mat-calendar-arrow {
  display: inline-block;
  width: 10px;
  height: 5px;
  margin: 0 0 0 5px;
  vertical-align: middle;
  fill: var(--mat-datepicker-calendar-period-button-icon-color, var(--mat-sys-on-surface-variant));
}
.mat-calendar-arrow.mat-calendar-invert {
  transform: rotate(180deg);
}
[dir=rtl] .mat-calendar-arrow {
  margin: 0 5px 0 0;
}
@media (forced-colors: active) {
  .mat-calendar-arrow {
    fill: CanvasText;
  }
}

.mat-datepicker-content .mat-calendar-previous-button:not(.mat-mdc-button-disabled),
.mat-datepicker-content .mat-calendar-next-button:not(.mat-mdc-button-disabled) {
  color: var(--mat-datepicker-calendar-navigation-button-icon-color, var(--mat-sys-on-surface-variant));
}
[dir=rtl] .mat-calendar-previous-button,
[dir=rtl] .mat-calendar-next-button {
  transform: rotate(180deg);
}

.mat-calendar-table {
  border-spacing: 0;
  border-collapse: collapse;
  width: 100%;
}

.mat-calendar-table-header th {
  text-align: center;
  padding: 0 0 8px 0;
  color: var(--mat-datepicker-calendar-header-text-color, var(--mat-sys-on-surface-variant));
  font-size: var(--mat-datepicker-calendar-header-text-size, var(--mat-sys-title-small-size));
  font-weight: var(--mat-datepicker-calendar-header-text-weight, var(--mat-sys-title-small-weight));
}

.mat-calendar-table-header-divider {
  position: relative;
  height: 1px;
}
.mat-calendar-table-header-divider::after {
  content: "";
  position: absolute;
  top: 0;
  left: -8px;
  right: -8px;
  height: 1px;
  background: var(--mat-datepicker-calendar-header-divider-color, transparent);
}

.mat-calendar-body-cell-content::before {
  margin: calc(calc(var(--mat-focus-indicator-border-width, 3px) + 3px) * -1);
}

.mat-calendar-body-cell:focus-visible .mat-focus-indicator::before {
  content: "";
}
`],encapsulation:2,changeDetection:0})}return i})(),Nr=new B("mat-datepicker-scroll-strategy",{providedIn:"root",factory:()=>{let i=s(j);return()=>Ne(i)}}),Ua=(()=>{class i{_elementRef=s(A);_animationsDisabled=we();_changeDetectorRef=s(ee);_globalModel=s(Ze);_dateAdapter=s(U);_ngZone=s(V);_rangeSelectionStrategy=s(Mn,{optional:!0});_stateChanges;_model;_eventCleanups;_animationFallback;_calendar;color;datepicker;comparisonStart=null;comparisonEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;_isAbove=!1;_animationDone=new O;_isAnimating=!1;_closeButtonText;_closeButtonFocused=!1;_actionsPortal=null;_dialogLabelId=null;constructor(){if(s(Ce).load(an),this._closeButtonText=s(wt).closeCalendarLabel,!this._animationsDisabled){let e=this._elementRef.nativeElement,t=s(Q);this._eventCleanups=this._ngZone.runOutsideAngular(()=>[t.listen(e,"animationstart",this._handleAnimationEvent),t.listen(e,"animationend",this._handleAnimationEvent),t.listen(e,"animationcancel",this._handleAnimationEvent)])}}ngAfterViewInit(){this._stateChanges=this.datepicker.stateChanges.subscribe(()=>{this._changeDetectorRef.markForCheck()}),this._calendar.focusActiveCell()}ngOnDestroy(){clearTimeout(this._animationFallback),this._eventCleanups?.forEach(e=>e()),this._stateChanges?.unsubscribe(),this._animationDone.complete()}_handleUserSelection(e){let t=this._model.selection,n=e.value,o=t instanceof K;if(o&&this._rangeSelectionStrategy){let r=this._rangeSelectionStrategy.selectionFinished(n,t,e.event);this._model.updateSelection(r,this)}else n&&(o||!this._dateAdapter.sameDate(n,t))&&this._model.add(n);(!this._model||this._model.isComplete())&&!this._actionsPortal&&this.datepicker.close()}_handleUserDragDrop(e){this._model.updateSelection(e.value,this)}_startExitAnimation(){this._elementRef.nativeElement.classList.add("mat-datepicker-content-exit"),this._animationsDisabled?this._animationDone.next():(clearTimeout(this._animationFallback),this._animationFallback=setTimeout(()=>{this._isAnimating||this._animationDone.next()},200))}_handleAnimationEvent=e=>{let t=this._elementRef.nativeElement;e.target!==t||!e.animationName.startsWith("_mat-datepicker-content")||(clearTimeout(this._animationFallback),this._isAnimating=e.type==="animationstart",t.classList.toggle("mat-datepicker-content-animating",this._isAnimating),this._isAnimating||this._animationDone.next())};_getSelected(){return this._model.selection}_applyPendingSelection(){this._model!==this._globalModel&&this._globalModel.updateSelection(this._model.selection,this)}_assignActions(e,t){this._model=e?this._globalModel.clone():this._globalModel,this._actionsPortal=e,t&&this._changeDetectorRef.detectChanges()}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-datepicker-content"]],viewQuery:function(t,n){if(t&1&&_e(mi,5),t&2){let o;F(o=L())&&(n._calendar=o.first)}},hostAttrs:[1,"mat-datepicker-content"],hostVars:6,hostBindings:function(t,n){t&2&&(We(n.color?"mat-"+n.color:""),D("mat-datepicker-content-touch",n.datepicker.touchUi)("mat-datepicker-content-animations-enabled",!n._animationsDisabled))},inputs:{color:"color"},exportAs:["matDatepickerContent"],decls:5,vars:26,consts:[["cdkTrapFocus","","role","dialog",1,"mat-datepicker-content-container"],[3,"yearSelected","monthSelected","viewChanged","_userSelection","_userDragDrop","id","startAt","startView","minDate","maxDate","dateFilter","headerComponent","selected","dateClass","comparisonStart","comparisonEnd","startDateAccessibleName","endDateAccessibleName"],[3,"cdkPortalOutlet"],["type","button","matButton","elevated",1,"mat-datepicker-close-button",3,"focus","blur","click","color"]],template:function(t,n){t&1&&(c(0,"div",0)(1,"mat-calendar",1),f("yearSelected",function(r){return n.datepicker._selectYear(r)})("monthSelected",function(r){return n.datepicker._selectMonth(r)})("viewChanged",function(r){return n.datepicker._viewChanged(r)})("_userSelection",function(r){return n._handleUserSelection(r)})("_userDragDrop",function(r){return n._handleUserDragDrop(r)}),p(),Ve(2,kr,0,0,"ng-template",2),c(3,"button",3),f("focus",function(){return n._closeButtonFocused=!0})("blur",function(){return n._closeButtonFocused=!1})("click",function(){return n.datepicker.close()}),_(4),p()()),t&2&&(D("mat-datepicker-content-container-with-custom-header",n.datepicker.calendarHeaderComponent)("mat-datepicker-content-container-with-actions",n._actionsPortal),w("aria-modal",!0)("aria-labelledby",n._dialogLabelId??void 0),l(),We(n.datepicker.panelClass),b("id",n.datepicker.id)("startAt",n.datepicker.startAt)("startView",n.datepicker.startView)("minDate",n.datepicker._getMinDate())("maxDate",n.datepicker._getMaxDate())("dateFilter",n.datepicker._getDateFilter())("headerComponent",n.datepicker.calendarHeaderComponent)("selected",n._getSelected())("dateClass",n.datepicker.dateClass)("comparisonStart",n.comparisonStart)("comparisonEnd",n.comparisonEnd)("startDateAccessibleName",n.startDateAccessibleName)("endDateAccessibleName",n.endDateAccessibleName),l(),b("cdkPortalOutlet",n._actionsPortal),l(),D("cdk-visually-hidden",!n._closeButtonFocused),b("color",n.color||"primary"),l(),k(n._closeButtonText))},dependencies:[$i,mi,Qn,qn],styles:[`@keyframes _mat-datepicker-content-dropdown-enter {
  from {
    opacity: 0;
    transform: scaleY(0.8);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes _mat-datepicker-content-dialog-enter {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes _mat-datepicker-content-exit {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
.mat-datepicker-content {
  display: block;
  background-color: var(--mat-datepicker-calendar-container-background-color, var(--mat-sys-surface-container-high));
  color: var(--mat-datepicker-calendar-container-text-color, var(--mat-sys-on-surface));
  box-shadow: var(--mat-datepicker-calendar-container-elevation-shadow, 0px 0px 0px 0px rgba(0, 0, 0, 0.2), 0px 0px 0px 0px rgba(0, 0, 0, 0.14), 0px 0px 0px 0px rgba(0, 0, 0, 0.12));
  border-radius: var(--mat-datepicker-calendar-container-shape, var(--mat-sys-corner-large));
}
.mat-datepicker-content.mat-datepicker-content-animations-enabled {
  animation: _mat-datepicker-content-dropdown-enter 120ms cubic-bezier(0, 0, 0.2, 1);
}
.mat-datepicker-content .mat-calendar {
  width: 296px;
  height: 354px;
}
.mat-datepicker-content .mat-datepicker-content-container-with-custom-header .mat-calendar {
  height: auto;
}
.mat-datepicker-content .mat-datepicker-close-button {
  position: absolute;
  top: 100%;
  left: 0;
  margin-top: 8px;
}
.mat-datepicker-content-animating .mat-datepicker-content .mat-datepicker-close-button {
  display: none;
}

.mat-datepicker-content-container {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.mat-datepicker-content-touch {
  display: block;
  max-height: 80vh;
  box-shadow: var(--mat-datepicker-calendar-container-touch-elevation-shadow, 0px 0px 0px 0px rgba(0, 0, 0, 0.2), 0px 0px 0px 0px rgba(0, 0, 0, 0.14), 0px 0px 0px 0px rgba(0, 0, 0, 0.12));
  border-radius: var(--mat-datepicker-calendar-container-touch-shape, var(--mat-sys-corner-extra-large));
  position: relative;
  overflow: visible;
  min-height: fit-content;
}
.mat-datepicker-content-touch.mat-datepicker-content-animations-enabled {
  animation: _mat-datepicker-content-dialog-enter 150ms cubic-bezier(0, 0, 0.2, 1);
}
.mat-datepicker-content-touch .mat-datepicker-content-container {
  min-height: 312px;
  max-height: 788px;
  min-width: 250px;
  max-width: 750px;
}
.mat-datepicker-content-touch .mat-calendar {
  width: 100%;
  height: auto;
}

.mat-datepicker-content-exit.mat-datepicker-content-animations-enabled {
  animation: _mat-datepicker-content-exit 100ms linear;
}

@media all and (orientation: landscape) {
  .mat-datepicker-content-touch .mat-datepicker-content-container {
    width: 64vh;
    height: 80vh;
  }
}
@media all and (orientation: portrait) {
  .mat-datepicker-content-touch .mat-datepicker-content-container {
    width: 80vw;
    height: 100vw;
  }
  .mat-datepicker-content-touch .mat-datepicker-content-container-with-actions {
    height: 115vw;
  }
}
`],encapsulation:2,changeDetection:0})}return i})(),Sn=(()=>{class i{_injector=s(j);_viewContainerRef=s(De);_dateAdapter=s(U,{optional:!0});_dir=s(le,{optional:!0});_model=s(Ze);_animationsDisabled=we();_scrollStrategy=s(Nr);_inputStateChanges=N.EMPTY;_document=s(re);calendarHeaderComponent;get startAt(){return this._startAt||(this.datepickerInput?this.datepickerInput.getStartValue():null)}set startAt(e){this._startAt=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_startAt=null;startView="month";get color(){return this._color||(this.datepickerInput?this.datepickerInput.getThemePalette():void 0)}set color(e){this._color=e}_color;touchUi=!1;get disabled(){return this._disabled===void 0&&this.datepickerInput?this.datepickerInput.disabled:!!this._disabled}set disabled(e){e!==this._disabled&&(this._disabled=e,this.stateChanges.next(void 0))}_disabled;xPosition="start";yPosition="below";restoreFocus=!0;yearSelected=new M;monthSelected=new M;viewChanged=new M(!0);dateClass;openedStream=new M;closedStream=new M;get panelClass(){return this._panelClass}set panelClass(e){this._panelClass=Zi(e)}_panelClass;get opened(){return this._opened}set opened(e){e?this.open():this.close()}_opened=!1;id=s(me).getId("mat-datepicker-");_getMinDate(){return this.datepickerInput&&this.datepickerInput.min}_getMaxDate(){return this.datepickerInput&&this.datepickerInput.max}_getDateFilter(){return this.datepickerInput&&this.datepickerInput.dateFilter}_overlayRef=null;_componentRef=null;_focusedElementBeforeOpen=null;_backdropHarnessClass=`${this.id}-backdrop`;_actionsPortal=null;datepickerInput;stateChanges=new O;_changeDetectorRef=s(ee);constructor(){this._dateAdapter,this._model.selectionChanged.subscribe(()=>{this._changeDetectorRef.markForCheck()})}ngOnChanges(e){let t=e.xPosition||e.yPosition;if(t&&!t.firstChange&&this._overlayRef){let n=this._overlayRef.getConfig().positionStrategy;n instanceof _t&&(this._setConnectedPositions(n),this.opened&&this._overlayRef.updatePosition())}this.stateChanges.next(void 0)}ngOnDestroy(){this._destroyOverlay(),this.close(),this._inputStateChanges.unsubscribe(),this.stateChanges.complete()}select(e){this._model.add(e)}_selectYear(e){this.yearSelected.emit(e)}_selectMonth(e){this.monthSelected.emit(e)}_viewChanged(e){this.viewChanged.emit(e)}registerInput(e){return this.datepickerInput,this._inputStateChanges.unsubscribe(),this.datepickerInput=e,this._inputStateChanges=e.stateChanges.subscribe(()=>this.stateChanges.next(void 0)),this._model}registerActions(e){this._actionsPortal,this._actionsPortal=e,this._componentRef?.instance._assignActions(e,!0)}removeActions(e){e===this._actionsPortal&&(this._actionsPortal=null,this._componentRef?.instance._assignActions(null,!0))}open(){this._opened||this.disabled||this._componentRef?.instance._isAnimating||(this.datepickerInput,this._focusedElementBeforeOpen=Et(),this._openOverlay(),this._opened=!0,this.openedStream.emit())}close(){if(!this._opened||this._componentRef?.instance._isAnimating)return;let e=this.restoreFocus&&this._focusedElementBeforeOpen&&typeof this._focusedElementBeforeOpen.focus=="function",t=()=>{this._opened&&(this._opened=!1,this.closedStream.emit())};if(this._componentRef){let{instance:n,location:o}=this._componentRef;n._animationDone.pipe(wi(1)).subscribe(()=>{let r=this._document.activeElement;e&&(!r||r===this._document.activeElement||o.nativeElement.contains(r))&&this._focusedElementBeforeOpen.focus(),this._focusedElementBeforeOpen=null,this._destroyOverlay()}),n._startExitAnimation()}e?setTimeout(t):t()}_applyPendingSelection(){this._componentRef?.instance?._applyPendingSelection()}_forwardContentValues(e){e.datepicker=this,e.color=this.color,e._dialogLabelId=this.datepickerInput.getOverlayLabelId(),e._assignActions(this._actionsPortal,!1)}_openOverlay(){this._destroyOverlay();let e=this.touchUi,t=new Xe(Ua,this._viewContainerRef),n=this._overlayRef=Ye(this._injector,new st({positionStrategy:e?this._getDialogStrategy():this._getDropdownStrategy(),hasBackdrop:!0,backdropClass:[e?"cdk-overlay-dark-backdrop":"mat-overlay-transparent-backdrop",this._backdropHarnessClass],direction:this._dir||"ltr",scrollStrategy:e?wn(this._injector):this._scrollStrategy(),panelClass:`mat-datepicker-${e?"dialog":"popup"}`,disableAnimations:this._animationsDisabled}));this._getCloseStream(n).subscribe(o=>{o&&o.preventDefault(),this.close()}),n.keydownEvents().subscribe(o=>{let r=o.keyCode;(r===38||r===40||r===37||r===39||r===33||r===34)&&o.preventDefault()}),this._componentRef=n.attach(t),this._forwardContentValues(this._componentRef.instance),e||ye(()=>{n.updatePosition()},{injector:this._injector})}_destroyOverlay(){this._overlayRef&&(this._overlayRef.dispose(),this._overlayRef=this._componentRef=null)}_getDialogStrategy(){return Dn(this._injector).centerHorizontally().centerVertically()}_getDropdownStrategy(){let e=He(this._injector,this.datepickerInput.getConnectedOverlayOrigin()).withTransformOriginOn(".mat-datepicker-content").withFlexibleDimensions(!1).withViewportMargin(8).withLockedPosition();return this._setConnectedPositions(e)}_setConnectedPositions(e){let t=this.xPosition==="end"?"end":"start",n=t==="start"?"end":"start",o=this.yPosition==="above"?"bottom":"top",r=o==="top"?"bottom":"top";return e.withPositions([{originX:t,originY:r,overlayX:t,overlayY:o},{originX:t,originY:o,overlayX:t,overlayY:r},{originX:n,originY:r,overlayX:n,overlayY:o},{originX:n,originY:o,overlayX:n,overlayY:r}])}_getCloseStream(e){let t=["ctrlKey","shiftKey","metaKey"];return Qe(e.backdropClick(),e.detachments(),e.keydownEvents().pipe(Ae(n=>n.keyCode===27&&!pe(n)||this.datepickerInput&&pe(n,"altKey")&&n.keyCode===38&&t.every(o=>!pe(n,o)))))}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,inputs:{calendarHeaderComponent:"calendarHeaderComponent",startAt:"startAt",startView:"startView",color:"color",touchUi:[2,"touchUi","touchUi",P],disabled:[2,"disabled","disabled",P],xPosition:"xPosition",yPosition:"yPosition",restoreFocus:[2,"restoreFocus","restoreFocus",P],dateClass:"dateClass",panelClass:"panelClass",opened:[2,"opened","opened",P]},outputs:{yearSelected:"yearSelected",monthSelected:"monthSelected",viewChanged:"viewChanged",openedStream:"opened",closedStream:"closed"},features:[fe]})}return i})(),Ka=(()=>{class i extends Sn{static \u0275fac=(()=>{let e;return function(n){return(e||(e=je(i)))(n||i)}})();static \u0275cmp=E({type:i,selectors:[["mat-datepicker"]],exportAs:["matDatepicker"],features:[X([Wa,{provide:Sn,useExisting:i}]),ce],decls:0,vars:0,template:function(t,n){},encapsulation:2,changeDetection:0})}return i})(),bt=class{target;targetElement;value=null;constructor(a,e){this.target=a,this.targetElement=e,this.value=this.target.value}},Ga=(()=>{class i{_elementRef=s(A);_dateAdapter=s(U,{optional:!0});_dateFormats=s(Be,{optional:!0});_isInitialized=!1;get value(){return this._model?this._getValueFromModel(this._model.selection):this._pendingValue}set value(e){this._assignValueProgrammatically(e,!0)}_model;get disabled(){return!!this._disabled||this._parentDisabled()}set disabled(e){let t=e,n=this._elementRef.nativeElement;this._disabled!==t&&(this._disabled=t,this.stateChanges.next(void 0)),t&&this._isInitialized&&n.blur&&n.blur()}_disabled;dateChange=new M;dateInput=new M;stateChanges=new O;_onTouched=()=>{};_validatorOnChange=()=>{};_cvaOnChange=()=>{};_valueChangesSubscription=N.EMPTY;_localeSubscription=N.EMPTY;_pendingValue=null;_parseValidator=()=>this._lastValueValid?null:{matDatepickerParse:{text:this._elementRef.nativeElement.value}};_filterValidator=e=>{let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value));return!t||this._matchesFilter(t)?null:{matDatepickerFilter:!0}};_minValidator=e=>{let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value)),n=this._getMinDate();return!n||!t||this._dateAdapter.compareDate(n,t)<=0?null:{matDatepickerMin:{min:n,actual:t}}};_maxValidator=e=>{let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value)),n=this._getMaxDate();return!n||!t||this._dateAdapter.compareDate(n,t)>=0?null:{matDatepickerMax:{max:n,actual:t}}};_getValidators(){return[this._parseValidator,this._minValidator,this._maxValidator,this._filterValidator]}_registerModel(e){this._model=e,this._valueChangesSubscription.unsubscribe(),this._pendingValue&&this._assignValue(this._pendingValue),this._valueChangesSubscription=this._model.selectionChanged.subscribe(t=>{if(this._shouldHandleChangeEvent(t)){let n=this._getValueFromModel(t.selection);this._lastValueValid=this._isValidValue(n),this._cvaOnChange(n),this._onTouched(),this._formatValue(n),this.dateInput.emit(new bt(this,this._elementRef.nativeElement)),this.dateChange.emit(new bt(this,this._elementRef.nativeElement))}})}_lastValueValid=!1;constructor(){this._localeSubscription=this._dateAdapter.localeChanges.subscribe(()=>{this._assignValueProgrammatically(this.value,!0)})}ngAfterViewInit(){this._isInitialized=!0}ngOnChanges(e){Za(e,this._dateAdapter)&&this.stateChanges.next(void 0)}ngOnDestroy(){this._valueChangesSubscription.unsubscribe(),this._localeSubscription.unsubscribe(),this.stateChanges.complete()}registerOnValidatorChange(e){this._validatorOnChange=e}validate(e){return this._validator?this._validator(e):null}writeValue(e){this._assignValueProgrammatically(e,e!==this.value)}registerOnChange(e){this._cvaOnChange=e}registerOnTouched(e){this._onTouched=e}setDisabledState(e){this.disabled=e}_onKeydown(e){let t=["ctrlKey","shiftKey","metaKey"];pe(e,"altKey")&&e.keyCode===40&&t.every(o=>!pe(e,o))&&!this._elementRef.nativeElement.readOnly&&(this._openPopup(),e.preventDefault())}_onInput(e){let t=e.target.value,n=this._lastValueValid,o=this._dateAdapter.parse(t,this._dateFormats.parse.dateInput);this._lastValueValid=this._isValidValue(o),o=this._dateAdapter.getValidDateOrNull(o);let r=!this._dateAdapter.sameDate(o,this.value);!o||r?this._cvaOnChange(o):(t&&!this.value&&this._cvaOnChange(o),n!==this._lastValueValid&&this._validatorOnChange()),r&&(this._assignValue(o),this.dateInput.emit(new bt(this,this._elementRef.nativeElement)))}_onChange(){this.dateChange.emit(new bt(this,this._elementRef.nativeElement))}_onBlur(){this.value&&this._formatValue(this.value),this._onTouched()}_formatValue(e){this._elementRef.nativeElement.value=e!=null?this._dateAdapter.format(e,this._dateFormats.display.dateInput):""}_assignValue(e){this._model?(this._assignValueToModel(e),this._pendingValue=null):this._pendingValue=e}_isValidValue(e){return!e||this._dateAdapter.isValid(e)}_parentDisabled(){return!1}_assignValueProgrammatically(e,t){e=this._dateAdapter.deserialize(e),this._lastValueValid=this._isValidValue(e),e=this._dateAdapter.getValidDateOrNull(e),this._assignValue(e),t&&this._formatValue(e)}_matchesFilter(e){let t=this._getDateFilter();return!t||t(e)}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,inputs:{value:"value",disabled:[2,"disabled","disabled",P]},outputs:{dateChange:"dateChange",dateInput:"dateInput"},features:[fe]})}return i})();function Za(i,a){let e=Object.keys(i);for(let t of e){let{previousValue:n,currentValue:o}=i[t];if(a.isDateInstance(n)&&a.isDateInstance(o)){if(!a.sameDate(n,o))return!0}else return!0}return!1}var Hr={provide:qe,useExisting:pt(()=>Pn),multi:!0},Yr={provide:mt,useExisting:pt(()=>Pn),multi:!0},Pn=(()=>{class i extends Ga{_formField=s($e,{optional:!0});_closedSubscription=N.EMPTY;_openedSubscription=N.EMPTY;set matDatepicker(e){e&&(this._datepicker=e,this._ariaOwns.set(e.opened?e.id:null),this._closedSubscription=e.closedStream.subscribe(()=>{this._onTouched(),this._ariaOwns.set(null)}),this._openedSubscription=e.openedStream.subscribe(()=>{this._ariaOwns.set(e.id)}),this._registerModel(e.registerInput(this)))}_datepicker;_ariaOwns=T(null);get min(){return this._min}set min(e){let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e));this._dateAdapter.sameDate(t,this._min)||(this._min=t,this._validatorOnChange())}_min=null;get max(){return this._max}set max(e){let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e));this._dateAdapter.sameDate(t,this._max)||(this._max=t,this._validatorOnChange())}_max=null;get dateFilter(){return this._dateFilter}set dateFilter(e){let t=this._matchesFilter(this.value);this._dateFilter=e,this._matchesFilter(this.value)!==t&&this._validatorOnChange()}_dateFilter;_validator=null;constructor(){super(),this._validator=Le.compose(super._getValidators())}getConnectedOverlayOrigin(){return this._formField?this._formField.getConnectedOverlayOrigin():this._elementRef}getOverlayLabelId(){return this._formField?this._formField.getLabelId():this._elementRef.nativeElement.getAttribute("aria-labelledby")}getThemePalette(){return this._formField?this._formField.color:void 0}getStartValue(){return this.value}ngOnDestroy(){super.ngOnDestroy(),this._closedSubscription.unsubscribe(),this._openedSubscription.unsubscribe()}_openPopup(){this._datepicker&&this._datepicker.open()}_getValueFromModel(e){return e}_assignValueToModel(e){this._model&&this._model.updateSelection(e,this)}_getMinDate(){return this._min}_getMaxDate(){return this._max}_getDateFilter(){return this._dateFilter}_shouldHandleChangeEvent(e){return e.source!==this}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["input","matDatepicker",""]],hostAttrs:[1,"mat-datepicker-input"],hostVars:6,hostBindings:function(t,n){t&1&&f("input",function(r){return n._onInput(r)})("change",function(){return n._onChange()})("blur",function(){return n._onBlur()})("keydown",function(r){return n._onKeydown(r)}),t&2&&(se("disabled",n.disabled),w("aria-haspopup",n._datepicker?"dialog":null)("aria-owns",n._ariaOwns())("min",n.min?n._dateAdapter.toIso8601(n.min):null)("max",n.max?n._dateAdapter.toIso8601(n.max):null)("data-mat-calendar",n._datepicker?n._datepicker.id:null))},inputs:{matDatepicker:"matDatepicker",min:"min",max:"max",dateFilter:[0,"matDatepickerFilter","dateFilter"]},exportAs:["matDatepickerInput"],features:[X([Hr,Yr,{provide:gt,useExisting:i}]),ce]})}return i})(),jr=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["","matDatepickerToggleIcon",""]]})}return i})(),Wr=(()=>{class i{_intl=s(wt);_changeDetectorRef=s(ee);_stateChanges=N.EMPTY;datepicker;tabIndex=null;ariaLabel;get disabled(){return this._disabled===void 0&&this.datepicker?this.datepicker.disabled:!!this._disabled}set disabled(e){this._disabled=e}_disabled;disableRipple=!1;_customIcon;_button;constructor(){let e=s(new Xt("tabindex"),{optional:!0}),t=Number(e);this.tabIndex=t||t===0?t:null}ngOnChanges(e){e.datepicker&&this._watchStateChanges()}ngOnDestroy(){this._stateChanges.unsubscribe()}ngAfterContentInit(){this._watchStateChanges()}_open(e){this.datepicker&&!this.disabled&&(this.datepicker.open(),e.stopPropagation())}_watchStateChanges(){let e=this.datepicker?this.datepicker.stateChanges:ct(),t=this.datepicker&&this.datepicker.datepickerInput?this.datepicker.datepickerInput.stateChanges:ct(),n=this.datepicker?Qe(this.datepicker.openedStream,this.datepicker.closedStream):ct();this._stateChanges.unsubscribe(),this._stateChanges=Qe(this._intl.changes,e,t,n).subscribe(()=>this._changeDetectorRef.markForCheck())}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-datepicker-toggle"]],contentQueries:function(t,n,o){if(t&1&&Ht(o,jr,5),t&2){let r;F(r=L())&&(n._customIcon=r.first)}},viewQuery:function(t,n){if(t&1&&_e(Mr,5),t&2){let o;F(o=L())&&(n._button=o.first)}},hostAttrs:[1,"mat-datepicker-toggle"],hostVars:8,hostBindings:function(t,n){t&1&&f("click",function(r){return n._open(r)}),t&2&&(w("tabindex",null)("data-mat-calendar",n.datepicker?n.datepicker.id:null),D("mat-datepicker-toggle-active",n.datepicker&&n.datepicker.opened)("mat-accent",n.datepicker&&n.datepicker.color==="accent")("mat-warn",n.datepicker&&n.datepicker.color==="warn"))},inputs:{datepicker:[0,"for","datepicker"],tabIndex:"tabIndex",ariaLabel:[0,"aria-label","ariaLabel"],disabled:[2,"disabled","disabled",P],disableRipple:"disableRipple"},exportAs:["matDatepickerToggle"],features:[fe],ngContentSelectors:Er,decls:4,vars:7,consts:[["button",""],["matIconButton","","type","button",3,"tabIndex","disabled","disableRipple"],["viewBox","0 0 24 24","width","24px","height","24px","fill","currentColor","focusable","false","aria-hidden","true",1,"mat-datepicker-toggle-default-icon"],["d","M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"]],template:function(t,n){t&1&&(ie(Sr),c(0,"button",1,0),v(2,Ar,2,0,":svg:svg",2),z(3),p()),t&2&&(b("tabIndex",n.disabled?-1:n.tabIndex)("disabled",n.disabled)("disableRipple",n.disableRipple),w("aria-haspopup",n.datepicker?"dialog":null)("aria-label",n.ariaLabel||n._intl.openCalendarLabel)("aria-expanded",n.datepicker?n.datepicker.opened:null),l(2),y(n._customIcon?-1:2))},dependencies:[ut],styles:[`.mat-datepicker-toggle {
  pointer-events: auto;
  color: var(--mat-datepicker-toggle-icon-color, var(--mat-sys-on-surface-variant));
}
.mat-datepicker-toggle button {
  color: inherit;
}

.mat-datepicker-toggle-active {
  color: var(--mat-datepicker-toggle-active-state-icon-color, var(--mat-sys-primary));
}

@media (forced-colors: active) {
  .mat-datepicker-toggle-default-icon {
    color: CanvasText;
  }
}
`],encapsulation:2,changeDetection:0})}return i})(),_i=(()=>{class i{_changeDetectorRef=s(ee);_elementRef=s(A);_dateAdapter=s(U,{optional:!0});_formField=s($e,{optional:!0});_closedSubscription=N.EMPTY;_openedSubscription=N.EMPTY;_startInput;_endInput;get value(){return this._model?this._model.selection:null}id=s(me).getId("mat-date-range-input-");focused=!1;get shouldLabelFloat(){return this.focused||!this.empty}controlType="mat-date-range-input";get placeholder(){let e=this._startInput?._getPlaceholder()||"",t=this._endInput?._getPlaceholder()||"";return e||t?`${e} ${this.separator} ${t}`:""}get rangePicker(){return this._rangePicker}set rangePicker(e){e&&(this._model=e.registerInput(this),this._rangePicker=e,this._closedSubscription.unsubscribe(),this._openedSubscription.unsubscribe(),this._ariaOwns.set(this.rangePicker.opened?e.id:null),this._closedSubscription=e.closedStream.subscribe(()=>{this._startInput?._onTouched(),this._endInput?._onTouched(),this._ariaOwns.set(null)}),this._openedSubscription=e.openedStream.subscribe(()=>{this._ariaOwns.set(e.id)}),this._registerModel(this._model))}_rangePicker;_ariaOwns=T(null);get required(){return this._required??(this._isTargetRequired(this)||this._isTargetRequired(this._startInput)||this._isTargetRequired(this._endInput))??!1}set required(e){this._required=e}_required;get dateFilter(){return this._dateFilter}set dateFilter(e){let t=this._startInput,n=this._endInput,o=t&&t._matchesFilter(t.value),r=n&&n._matchesFilter(t.value);this._dateFilter=e,t&&t._matchesFilter(t.value)!==o&&t._validatorOnChange(),n&&n._matchesFilter(n.value)!==r&&n._validatorOnChange()}_dateFilter;get min(){return this._min}set min(e){let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e));this._dateAdapter.sameDate(t,this._min)||(this._min=t,this._revalidate())}_min=null;get max(){return this._max}set max(e){let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e));this._dateAdapter.sameDate(t,this._max)||(this._max=t,this._revalidate())}_max=null;get disabled(){return this._startInput&&this._endInput?this._startInput.disabled&&this._endInput.disabled:this._groupDisabled}set disabled(e){e!==this._groupDisabled&&(this._groupDisabled=e,this.stateChanges.next(void 0))}_groupDisabled=!1;get errorState(){return this._startInput&&this._endInput?this._startInput.errorState||this._endInput.errorState:!1}get empty(){let e=this._startInput?this._startInput.isEmpty():!1,t=this._endInput?this._endInput.isEmpty():!1;return e&&t}_ariaDescribedBy=null;_model;separator="\u2013";comparisonStart=null;comparisonEnd=null;ngControl;stateChanges=new O;disableAutomaticLabeling=!0;constructor(){this._dateAdapter,this._formField?._elementRef.nativeElement.classList.contains("mat-mdc-form-field")&&this._elementRef.nativeElement.classList.add("mat-mdc-input-element","mat-mdc-form-field-input-control","mdc-text-field__input"),this.ngControl=s(Hi,{optional:!0,self:!0})}get describedByIds(){return this._elementRef.nativeElement.getAttribute("aria-describedby")?.split(" ")||[]}setDescribedByIds(e){this._ariaDescribedBy=e.length?e.join(" "):null}onContainerClick(){!this.focused&&!this.disabled&&(!this._model||!this._model.selection.start?this._startInput.focus():this._endInput.focus())}ngAfterContentInit(){this._model&&this._registerModel(this._model),Qe(this._startInput.stateChanges,this._endInput.stateChanges).subscribe(()=>{this.stateChanges.next(void 0)})}ngOnChanges(e){Za(e,this._dateAdapter)&&this.stateChanges.next(void 0)}ngOnDestroy(){this._closedSubscription.unsubscribe(),this._openedSubscription.unsubscribe(),this.stateChanges.complete()}getStartValue(){return this.value?this.value.start:null}getThemePalette(){return this._formField?this._formField.color:void 0}getConnectedOverlayOrigin(){return this._formField?this._formField.getConnectedOverlayOrigin():this._elementRef}getOverlayLabelId(){return this._formField?this._formField.getLabelId():null}_getInputMirrorValue(e){let t=e==="start"?this._startInput:this._endInput;return t?t.getMirrorValue():""}_shouldHidePlaceholders(){return this._startInput?!this._startInput.isEmpty():!1}_handleChildValueChange(){this.stateChanges.next(void 0),this._changeDetectorRef.markForCheck()}_openDatepicker(){this._rangePicker&&this._rangePicker.open()}_shouldHideSeparator(){return(!this._formField||this._formField.getLabelId()&&!this._formField._shouldLabelFloat())&&this.empty}_getAriaLabelledby(){let e=this._formField;return e&&e._hasFloatingLabel()?e._labelId:null}_getStartDateAccessibleName(){return this._startInput._getAccessibleName()}_getEndDateAccessibleName(){return this._endInput._getAccessibleName()}_updateFocus(e){this.focused=e!==null,this.stateChanges.next()}_revalidate(){this._startInput&&this._startInput._validatorOnChange(),this._endInput&&this._endInput._validatorOnChange()}_registerModel(e){this._startInput&&this._startInput._registerModel(e),this._endInput&&this._endInput._registerModel(e)}_isTargetRequired(e){return e?.ngControl?.control?.hasValidator(Le.required)}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-date-range-input"]],hostAttrs:["role","group",1,"mat-date-range-input"],hostVars:8,hostBindings:function(t,n){t&2&&(w("id",n.id)("aria-labelledby",n._getAriaLabelledby())("aria-describedby",n._ariaDescribedBy)("data-mat-calendar",n.rangePicker?n.rangePicker.id:null),D("mat-date-range-input-hide-placeholders",n._shouldHidePlaceholders())("mat-date-range-input-required",n.required))},inputs:{rangePicker:"rangePicker",required:[2,"required","required",P],dateFilter:"dateFilter",min:"min",max:"max",disabled:[2,"disabled","disabled",P],separator:"separator",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd"},exportAs:["matDateRangeInput"],features:[X([{provide:Tt,useExisting:i}]),fe],ngContentSelectors:Tr,decls:11,vars:5,consts:[["cdkMonitorSubtreeFocus","",1,"mat-date-range-input-container",3,"cdkFocusChange"],[1,"mat-date-range-input-wrapper"],["aria-hidden","true",1,"mat-date-range-input-mirror"],[1,"mat-date-range-input-separator"],[1,"mat-date-range-input-wrapper","mat-date-range-input-end-wrapper"]],template:function(t,n){t&1&&(ie(Pr),c(0,"div",0),f("cdkFocusChange",function(r){return n._updateFocus(r)}),c(1,"div",1),z(2),c(3,"span",2),_(4),p()(),c(5,"span",3),_(6),p(),c(7,"div",4),z(8,1),c(9,"span",2),_(10),p()()()),t&2&&(l(4),k(n._getInputMirrorValue("start")),l(),D("mat-date-range-input-separator-hidden",n._shouldHideSeparator()),l(),k(n.separator),l(4),k(n._getInputMirrorValue("end")))},dependencies:[Hn],styles:[`.mat-date-range-input {
  display: block;
  width: 100%;
}

.mat-date-range-input-container {
  display: flex;
  align-items: center;
}

.mat-date-range-input-separator {
  transition: opacity 400ms 133.3333333333ms cubic-bezier(0.25, 0.8, 0.25, 1);
  margin: 0 4px;
  color: var(--mat-datepicker-range-input-separator-color, var(--mat-sys-on-surface));
}
.mat-form-field-disabled .mat-date-range-input-separator {
  color: var(--mat-datepicker-range-input-disabled-state-separator-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
._mat-animation-noopable .mat-date-range-input-separator {
  transition: none;
}

.mat-date-range-input-separator-hidden {
  -webkit-user-select: none;
  user-select: none;
  opacity: 0;
  transition: none;
}

.mat-date-range-input-wrapper {
  position: relative;
  overflow: hidden;
  max-width: calc(50% - 4px);
}

.mat-date-range-input-end-wrapper {
  flex-grow: 1;
}

.mat-date-range-input-inner {
  position: absolute;
  top: 0;
  left: 0;
  font: inherit;
  background: transparent;
  color: currentColor;
  border: none;
  outline: none;
  padding: 0;
  margin: 0;
  vertical-align: bottom;
  text-align: inherit;
  -webkit-appearance: none;
  width: 100%;
  height: 100%;
}
.mat-date-range-input-inner:-moz-ui-invalid {
  box-shadow: none;
}
.mat-date-range-input-inner::placeholder {
  transition: color 400ms 133.3333333333ms cubic-bezier(0.25, 0.8, 0.25, 1);
}
.mat-date-range-input-inner::-moz-placeholder {
  transition: color 400ms 133.3333333333ms cubic-bezier(0.25, 0.8, 0.25, 1);
}
.mat-date-range-input-inner::-webkit-input-placeholder {
  transition: color 400ms 133.3333333333ms cubic-bezier(0.25, 0.8, 0.25, 1);
}
.mat-date-range-input-inner:-ms-input-placeholder {
  transition: color 400ms 133.3333333333ms cubic-bezier(0.25, 0.8, 0.25, 1);
}
.mat-date-range-input-inner[disabled] {
  color: var(--mat-datepicker-range-input-disabled-state-text-color, color-mix(in srgb, var(--mat-sys-on-surface) 38%, transparent));
}
.mat-form-field-hide-placeholder .mat-date-range-input-inner::placeholder, .mat-date-range-input-hide-placeholders .mat-date-range-input-inner::placeholder {
  -webkit-user-select: none;
  user-select: none;
  color: transparent !important;
  -webkit-text-fill-color: transparent;
  transition: none;
}
@media (forced-colors: active) {
  .mat-form-field-hide-placeholder .mat-date-range-input-inner::placeholder, .mat-date-range-input-hide-placeholders .mat-date-range-input-inner::placeholder {
    opacity: 0;
  }
}
.mat-form-field-hide-placeholder .mat-date-range-input-inner::-moz-placeholder, .mat-date-range-input-hide-placeholders .mat-date-range-input-inner::-moz-placeholder {
  -webkit-user-select: none;
  user-select: none;
  color: transparent !important;
  -webkit-text-fill-color: transparent;
  transition: none;
}
@media (forced-colors: active) {
  .mat-form-field-hide-placeholder .mat-date-range-input-inner::-moz-placeholder, .mat-date-range-input-hide-placeholders .mat-date-range-input-inner::-moz-placeholder {
    opacity: 0;
  }
}
.mat-form-field-hide-placeholder .mat-date-range-input-inner::-webkit-input-placeholder, .mat-date-range-input-hide-placeholders .mat-date-range-input-inner::-webkit-input-placeholder {
  -webkit-user-select: none;
  user-select: none;
  color: transparent !important;
  -webkit-text-fill-color: transparent;
  transition: none;
}
@media (forced-colors: active) {
  .mat-form-field-hide-placeholder .mat-date-range-input-inner::-webkit-input-placeholder, .mat-date-range-input-hide-placeholders .mat-date-range-input-inner::-webkit-input-placeholder {
    opacity: 0;
  }
}
.mat-form-field-hide-placeholder .mat-date-range-input-inner:-ms-input-placeholder, .mat-date-range-input-hide-placeholders .mat-date-range-input-inner:-ms-input-placeholder {
  -webkit-user-select: none;
  user-select: none;
  color: transparent !important;
  -webkit-text-fill-color: transparent;
  transition: none;
}
@media (forced-colors: active) {
  .mat-form-field-hide-placeholder .mat-date-range-input-inner:-ms-input-placeholder, .mat-date-range-input-hide-placeholders .mat-date-range-input-inner:-ms-input-placeholder {
    opacity: 0;
  }
}
._mat-animation-noopable .mat-date-range-input-inner::placeholder {
  transition: none;
}
._mat-animation-noopable .mat-date-range-input-inner::-moz-placeholder {
  transition: none;
}
._mat-animation-noopable .mat-date-range-input-inner::-webkit-input-placeholder {
  transition: none;
}
._mat-animation-noopable .mat-date-range-input-inner:-ms-input-placeholder {
  transition: none;
}

.mat-date-range-input-mirror {
  -webkit-user-select: none;
  user-select: none;
  visibility: hidden;
  white-space: nowrap;
  display: inline-block;
  min-width: 2px;
}

.mat-mdc-form-field-type-mat-date-range-input .mat-mdc-form-field-infix {
  width: 200px;
}
`],encapsulation:2,changeDetection:0})}return i})();function qr(i){return ui(i,!0)}function Ya(i){return i.nodeType===Node.ELEMENT_NODE}function $r(i){return i.nodeName==="INPUT"}function Xr(i){return i.nodeName==="TEXTAREA"}function ui(i,a){if(Ya(i)&&a){let t=(i.getAttribute?.("aria-labelledby")?.split(/\s+/g)||[]).reduce((n,o)=>{let r=document.getElementById(o);return r&&n.push(r),n},[]);if(t.length)return t.map(n=>ui(n,!1)).join(" ")}if(Ya(i)){let e=i.getAttribute("aria-label")?.trim();if(e)return e}if($r(i)||Xr(i)){if(i.labels?.length)return Array.from(i.labels).map(n=>ui(n,!1)).join(" ");let e=i.getAttribute("placeholder")?.trim();if(e)return e;let t=i.getAttribute("title")?.trim();if(t)return t}return(i.textContent||"").replace(/\s+/g," ").trim()}var Qa=(()=>{class i extends Ga{_rangeInput=s(_i);_elementRef=s(A);_defaultErrorStateMatcher=s(sn);_injector=s(j);_rawValue=T("");_parentForm=s(Jt,{optional:!0});_parentFormGroup=s(tn,{optional:!0});ngControl;_dir=s(le,{optional:!0});_errorStateTracker;get errorStateMatcher(){return this._errorStateTracker.matcher}set errorStateMatcher(e){this._errorStateTracker.matcher=e}get errorState(){return this._errorStateTracker.errorState}set errorState(e){this._errorStateTracker.errorState=e}constructor(){super(),this._errorStateTracker=new pn(this._defaultErrorStateMatcher,null,this._parentFormGroup,this._parentForm,this.stateChanges)}ngOnInit(){let e=this._injector.get(Zt,null,{optional:!0,self:!0});e&&(this.ngControl=e,this._errorStateTracker.ngControl=e)}ngAfterContentInit(){this._register()}ngDoCheck(){this.ngControl&&this.updateErrorState(),this._rawValue.set(this._elementRef.nativeElement.value)}isEmpty(){return this._rawValue().length===0}_getPlaceholder(){return this._elementRef.nativeElement.placeholder}focus(){this._elementRef.nativeElement.focus()}getMirrorValue(){let e=this._rawValue();return e.length>0?e:this._getPlaceholder()}updateErrorState(){this._errorStateTracker.updateErrorState()}_onInput(e){super._onInput(e),this._rangeInput._handleChildValueChange()}_openPopup(){this._rangeInput._openDatepicker()}_getMinDate(){return this._rangeInput.min}_getMaxDate(){return this._rangeInput.max}_getDateFilter(){return this._rangeInput.dateFilter}_parentDisabled(){return this._rangeInput._groupDisabled}_shouldHandleChangeEvent({source:e}){return e!==this._rangeInput._startInput&&e!==this._rangeInput._endInput}_assignValueProgrammatically(e,t){super._assignValueProgrammatically(e,t),(this===this._rangeInput._startInput?this._rangeInput._endInput:this._rangeInput._startInput)?._validatorOnChange(),this._rawValue.set(this._elementRef.nativeElement.value)}_formatValue(e){super._formatValue(e),this._rangeInput._handleChildValueChange()}_getAccessibleName(){return qr(this._elementRef.nativeElement)}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,inputs:{errorStateMatcher:"errorStateMatcher"},features:[ce]})}return i})(),Ja=(()=>{class i extends Qa{_startValidator=e=>{let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value)),n=this._model?this._model.selection.end:null;return!t||!n||this._dateAdapter.compareDate(t,n)<=0?null:{matStartDateInvalid:{end:n,actual:t}}};_validator=Le.compose([...super._getValidators(),this._startValidator]);_register(){this._rangeInput._startInput=this}_getValueFromModel(e){return e.start}_shouldHandleChangeEvent(e){return super._shouldHandleChangeEvent(e)?e.oldValue?.start?!e.selection.start||!!this._dateAdapter.compareDate(e.oldValue.start,e.selection.start):!!e.selection.start:!1}_assignValueToModel(e){if(this._model){let t=new K(e,this._model.selection.end);this._model.updateSelection(t,this),this._rangeInput._handleChildValueChange()}}_onKeydown(e){let t=this._rangeInput._endInput,n=this._elementRef.nativeElement,o=this._dir?.value!=="rtl";(e.keyCode===39&&o||e.keyCode===37&&!o)&&n.selectionStart===n.value.length&&n.selectionEnd===n.value.length?(e.preventDefault(),t._elementRef.nativeElement.setSelectionRange(0,0),t.focus()):super._onKeydown(e)}static \u0275fac=(()=>{let e;return function(n){return(e||(e=je(i)))(n||i)}})();static \u0275dir=I({type:i,selectors:[["input","matStartDate",""]],hostAttrs:["type","text",1,"mat-start-date","mat-date-range-input-inner"],hostVars:5,hostBindings:function(t,n){t&1&&f("input",function(r){return n._onInput(r)})("change",function(){return n._onChange()})("keydown",function(r){return n._onKeydown(r)})("blur",function(){return n._onBlur()}),t&2&&(se("disabled",n.disabled),w("aria-haspopup",n._rangeInput.rangePicker?"dialog":null)("aria-owns",n._rangeInput._ariaOwns()||null)("min",n._getMinDate()?n._dateAdapter.toIso8601(n._getMinDate()):null)("max",n._getMaxDate()?n._dateAdapter.toIso8601(n._getMaxDate()):null))},outputs:{dateChange:"dateChange",dateInput:"dateInput"},features:[X([{provide:qe,useExisting:i,multi:!0},{provide:mt,useExisting:i,multi:!0}]),ce]})}return i})(),eo=(()=>{class i extends Qa{_endValidator=e=>{let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value)),n=this._model?this._model.selection.start:null;return!t||!n||this._dateAdapter.compareDate(t,n)>=0?null:{matEndDateInvalid:{start:n,actual:t}}};_register(){this._rangeInput._endInput=this}_validator=Le.compose([...super._getValidators(),this._endValidator]);_getValueFromModel(e){return e.end}_shouldHandleChangeEvent(e){return super._shouldHandleChangeEvent(e)?e.oldValue?.end?!e.selection.end||!!this._dateAdapter.compareDate(e.oldValue.end,e.selection.end):!!e.selection.end:!1}_assignValueToModel(e){if(this._model){let t=new K(this._model.selection.start,e);this._model.updateSelection(t,this)}}_moveCaretToEndOfStartInput(){let e=this._rangeInput._startInput._elementRef.nativeElement,t=e.value;t.length>0&&e.setSelectionRange(t.length,t.length),e.focus()}_onKeydown(e){let t=this._elementRef.nativeElement,n=this._dir?.value!=="rtl";e.keyCode===8&&!t.value?this._moveCaretToEndOfStartInput():(e.keyCode===37&&n||e.keyCode===39&&!n)&&t.selectionStart===0&&t.selectionEnd===0?(e.preventDefault(),this._moveCaretToEndOfStartInput()):super._onKeydown(e)}static \u0275fac=(()=>{let e;return function(n){return(e||(e=je(i)))(n||i)}})();static \u0275dir=I({type:i,selectors:[["input","matEndDate",""]],hostAttrs:["type","text",1,"mat-end-date","mat-date-range-input-inner"],hostVars:5,hostBindings:function(t,n){t&1&&f("input",function(r){return n._onInput(r)})("change",function(){return n._onChange()})("keydown",function(r){return n._onKeydown(r)})("blur",function(){return n._onBlur()}),t&2&&(se("disabled",n.disabled),w("aria-haspopup",n._rangeInput.rangePicker?"dialog":null)("aria-owns",n._rangeInput._ariaOwns()||null)("min",n._getMinDate()?n._dateAdapter.toIso8601(n._getMinDate()):null)("max",n._getMaxDate()?n._dateAdapter.toIso8601(n._getMaxDate()):null))},outputs:{dateChange:"dateChange",dateInput:"dateInput"},features:[X([{provide:qe,useExisting:i,multi:!0},{provide:mt,useExisting:i,multi:!0}]),ce]})}return i})(),to=(()=>{class i extends Sn{_forwardContentValues(e){super._forwardContentValues(e);let t=this.datepickerInput;t&&(e.comparisonStart=t.comparisonStart,e.comparisonEnd=t.comparisonEnd,e.startDateAccessibleName=t._getStartDateAccessibleName(),e.endDateAccessibleName=t._getEndDateAccessibleName())}static \u0275fac=(()=>{let e;return function(n){return(e||(e=je(i)))(n||i)}})();static \u0275cmp=E({type:i,selectors:[["mat-date-range-picker"]],exportAs:["matDateRangePicker"],features:[X([Fr,{provide:Mn,useFactory:()=>s(Mn,{optional:!0,skipSelf:!0})||new Lr(s(U))},{provide:Sn,useExisting:i}]),ce],decls:0,vars:0,template:function(t,n){},encapsulation:2,changeDetection:0})}return i})();var no=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=$({type:i});static \u0275inj=q({providers:[wt],imports:[aa,ai,Xi,_n,Ua,Wr,Xa,ge,ot]})}return i})();var Ft=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=$({type:i});static \u0275inj=q({imports:[qi,un,ge]})}return i})();var Gr=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["ng-component"]],hostAttrs:["cdk-text-field-style-loader",""],decls:0,vars:0,template:function(t,n){},styles:[`textarea.cdk-textarea-autosize {
  resize: none;
}

textarea.cdk-textarea-autosize-measuring {
  padding: 2px 0 !important;
  box-sizing: content-box !important;
  height: auto !important;
  overflow: hidden !important;
}

textarea.cdk-textarea-autosize-measuring-firefox {
  padding: 2px 0 !important;
  box-sizing: content-box !important;
  height: 0 !important;
}

@keyframes cdk-text-field-autofill-start { /*!*/ }
@keyframes cdk-text-field-autofill-end { /*!*/ }
.cdk-text-field-autofill-monitored:-webkit-autofill {
  animation: cdk-text-field-autofill-start 0s 1ms;
}

.cdk-text-field-autofill-monitored:not(:-webkit-autofill) {
  animation: cdk-text-field-autofill-end 0s 1ms;
}
`],encapsulation:2,changeDetection:0})}return i})(),Zr={passive:!0},io=(()=>{class i{_platform=s(te);_ngZone=s(V);_renderer=s(Re).createRenderer(null,null);_styleLoader=s(Ce);_monitoredElements=new Map;constructor(){}monitor(e){if(!this._platform.isBrowser)return xi;this._styleLoader.load(Gr);let t=Pt(e),n=this._monitoredElements.get(t);if(n)return n.subject;let o=new O,r="cdk-text-field-autofilled",m=C=>{C.animationName==="cdk-text-field-autofill-start"&&!t.classList.contains(r)?(t.classList.add(r),this._ngZone.run(()=>o.next({target:C.target,isAutofilled:!0}))):C.animationName==="cdk-text-field-autofill-end"&&t.classList.contains(r)&&(t.classList.remove(r),this._ngZone.run(()=>o.next({target:C.target,isAutofilled:!1})))},g=this._ngZone.runOutsideAngular(()=>(t.classList.add("cdk-text-field-autofill-monitored"),this._renderer.listen(t,"animationstart",m,Zr)));return this._monitoredElements.set(t,{subject:o,unlisten:g}),o}stopMonitoring(e){let t=Pt(e),n=this._monitoredElements.get(t);n&&(n.unlisten(),n.subject.complete(),t.classList.remove("cdk-text-field-autofill-monitored"),t.classList.remove("cdk-text-field-autofilled"),this._monitoredElements.delete(t))}ngOnDestroy(){this._monitoredElements.forEach((e,t)=>this.stopMonitoring(t))}static \u0275fac=function(t){return new(t||i)};static \u0275prov=H({token:i,factory:i.\u0275fac,providedIn:"root"})}return i})();var ao=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=$({type:i});static \u0275inj=q({})}return i})();var Qr=["button","checkbox","file","hidden","image","radio","range","reset","submit"],Jr=new B("MAT_INPUT_CONFIG"),oo=(()=>{class i{_elementRef=s(A);_platform=s(te);ngControl=s(Zt,{optional:!0,self:!0});_autofillMonitor=s(io);_ngZone=s(V);_formField=s($e,{optional:!0});_renderer=s(Q);_uid=s(me).getId("mat-input-");_previousNativeValue;_inputValueAccessor;_signalBasedValueAccessor;_previousPlaceholder=null;_errorStateTracker;_config=s(Jr,{optional:!0});_cleanupIosKeyup;_cleanupWebkitWheel;_isServer=!1;_isNativeSelect=!1;_isTextarea=!1;_isInFormField=!1;focused=!1;stateChanges=new O;controlType="mat-input";autofilled=!1;get disabled(){return this._disabled}set disabled(e){this._disabled=ze(e),this.focused&&(this.focused=!1,this.stateChanges.next())}_disabled=!1;get id(){return this._id}set id(e){this._id=e||this._uid}_id;placeholder;name;get required(){return this._required??this.ngControl?.control?.hasValidator(Le.required)??!1}set required(e){this._required=ze(e)}_required;get type(){return this._type}set type(e){this._type=e||"text",this._validateType(),!this._isTextarea&&jn().has(this._type)&&(this._elementRef.nativeElement.type=this._type)}_type="text";get errorStateMatcher(){return this._errorStateTracker.matcher}set errorStateMatcher(e){this._errorStateTracker.matcher=e}userAriaDescribedBy;get value(){return this._signalBasedValueAccessor?this._signalBasedValueAccessor.value():this._inputValueAccessor.value}set value(e){e!==this.value&&(this._signalBasedValueAccessor?this._signalBasedValueAccessor.value.set(e):this._inputValueAccessor.value=e,this.stateChanges.next())}get readonly(){return this._readonly}set readonly(e){this._readonly=ze(e)}_readonly=!1;disabledInteractive;get errorState(){return this._errorStateTracker.errorState}set errorState(e){this._errorStateTracker.errorState=e}_neverEmptyInputTypes=["date","datetime","datetime-local","month","time","week"].filter(e=>jn().has(e));constructor(){let e=s(Jt,{optional:!0}),t=s(tn,{optional:!0}),n=s(sn),o=s(gt,{optional:!0,self:!0}),r=this._elementRef.nativeElement,m=r.nodeName.toLowerCase();o?Ei(o.value)?this._signalBasedValueAccessor=o:this._inputValueAccessor=o:this._inputValueAccessor=r,this._previousNativeValue=this.value,this.id=this.id,this._platform.IOS&&this._ngZone.runOutsideAngular(()=>{this._cleanupIosKeyup=this._renderer.listen(r,"keyup",this._iOSKeyupListener)}),this._errorStateTracker=new pn(n,this.ngControl,t,e,this.stateChanges),this._isServer=!this._platform.isBrowser,this._isNativeSelect=m==="select",this._isTextarea=m==="textarea",this._isInFormField=!!this._formField,this.disabledInteractive=this._config?.disabledInteractive||!1,this._isNativeSelect&&(this.controlType=r.multiple?"mat-native-select-multiple":"mat-native-select"),this._signalBasedValueAccessor&&Ie(()=>{this._signalBasedValueAccessor.value(),this.stateChanges.next()})}ngAfterViewInit(){this._platform.isBrowser&&this._autofillMonitor.monitor(this._elementRef.nativeElement).subscribe(e=>{this.autofilled=e.isAutofilled,this.stateChanges.next()})}ngOnChanges(){this.stateChanges.next()}ngOnDestroy(){this.stateChanges.complete(),this._platform.isBrowser&&this._autofillMonitor.stopMonitoring(this._elementRef.nativeElement),this._cleanupIosKeyup?.(),this._cleanupWebkitWheel?.()}ngDoCheck(){this.ngControl&&(this.updateErrorState(),this.ngControl.disabled!==null&&this.ngControl.disabled!==this.disabled&&(this.disabled=this.ngControl.disabled,this.stateChanges.next())),this._dirtyCheckNativeValue(),this._dirtyCheckPlaceholder()}focus(e){this._elementRef.nativeElement.focus(e)}updateErrorState(){this._errorStateTracker.updateErrorState()}_focusChanged(e){if(e!==this.focused){if(!this._isNativeSelect&&e&&this.disabled&&this.disabledInteractive){let t=this._elementRef.nativeElement;t.type==="number"?(t.type="text",t.setSelectionRange(0,0),t.type="number"):t.setSelectionRange(0,0)}this.focused=e,this.stateChanges.next()}}_onInput(){}_dirtyCheckNativeValue(){let e=this._elementRef.nativeElement.value;this._previousNativeValue!==e&&(this._previousNativeValue=e,this.stateChanges.next())}_dirtyCheckPlaceholder(){let e=this._getPlaceholder();if(e!==this._previousPlaceholder){let t=this._elementRef.nativeElement;this._previousPlaceholder=e,e?t.setAttribute("placeholder",e):t.removeAttribute("placeholder")}}_getPlaceholder(){return this.placeholder||null}_validateType(){Qr.indexOf(this._type)>-1}_isNeverEmpty(){return this._neverEmptyInputTypes.indexOf(this._type)>-1}_isBadInput(){let e=this._elementRef.nativeElement.validity;return e&&e.badInput}get empty(){return!this._isNeverEmpty()&&!this._elementRef.nativeElement.value&&!this._isBadInput()&&!this.autofilled}get shouldLabelFloat(){if(this._isNativeSelect){let e=this._elementRef.nativeElement,t=e.options[0];return this.focused||e.multiple||!this.empty||!!(e.selectedIndex>-1&&t&&t.label)}else return this.focused&&!this.disabled||!this.empty}get describedByIds(){return this._elementRef.nativeElement.getAttribute("aria-describedby")?.split(" ")||[]}setDescribedByIds(e){let t=this._elementRef.nativeElement;e.length?t.setAttribute("aria-describedby",e.join(" ")):t.removeAttribute("aria-describedby")}onContainerClick(){this.focused||this.focus()}_isInlineSelect(){let e=this._elementRef.nativeElement;return this._isNativeSelect&&(e.multiple||e.size>1)}_iOSKeyupListener=e=>{let t=e.target;!t.value&&t.selectionStart===0&&t.selectionEnd===0&&(t.setSelectionRange(1,1),t.setSelectionRange(0,0))};_getReadonlyAttribute(){return this._isNativeSelect?null:this.readonly||this.disabled&&this.disabledInteractive?"true":null}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["input","matInput",""],["textarea","matInput",""],["select","matNativeControl",""],["input","matNativeControl",""],["textarea","matNativeControl",""]],hostAttrs:[1,"mat-mdc-input-element"],hostVars:21,hostBindings:function(t,n){t&1&&f("focus",function(){return n._focusChanged(!0)})("blur",function(){return n._focusChanged(!1)})("input",function(){return n._onInput()}),t&2&&(se("id",n.id)("disabled",n.disabled&&!n.disabledInteractive)("required",n.required),w("name",n.name||null)("readonly",n._getReadonlyAttribute())("aria-disabled",n.disabled&&n.disabledInteractive?"true":null)("aria-invalid",n.empty&&n.required?null:n.errorState)("aria-required",n.required)("id",n.id),D("mat-input-server",n._isServer)("mat-mdc-form-field-textarea-control",n._isInFormField&&n._isTextarea)("mat-mdc-form-field-input-control",n._isInFormField)("mat-mdc-input-disabled-interactive",n.disabledInteractive)("mdc-text-field__input",n._isInFormField)("mat-mdc-native-select-inline",n._isInlineSelect()))},inputs:{disabled:"disabled",id:"id",placeholder:"placeholder",name:"name",required:"required",type:"type",errorStateMatcher:"errorStateMatcher",userAriaDescribedBy:[0,"aria-describedby","userAriaDescribedBy"],value:"value",readonly:"readonly",disabledInteractive:[2,"disabledInteractive","disabledInteractive",P]},exportAs:["matInput"],features:[X([{provide:Tt,useExisting:i}]),fe]})}return i})(),ro=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=$({type:i});static \u0275inj=q({imports:[Ft,Ft,ao,ge]})}return i})();var ns=["panelTemplate"],is=(i,a)=>a.value;function as(i,a){if(i&1){let e=R();c(0,"mat-option",3),f("onSelectionChange",function(n){u(e);let o=d(2);return h(o._selectValue(n.source))}),_(1),p()}if(i&2){let e=a.$implicit;b("value",e.value),l(),k(e.label)}}function os(i,a){if(i&1){let e=R();c(0,"div",1),f("animationend",function(n){u(e);let o=d();return h(o._handleAnimationEnd(n))}),ke(1,as,2,2,"mat-option",2,is),p()}if(i&2){let e=d();D("mat-timepicker-panel-animations-enabled",!e._animationsDisabled)("mat-timepicker-panel-exit",!e.isOpen()),b("id",e.panelId),w("aria-label",e.ariaLabel()||null)("aria-labelledby",e._getAriaLabelledby()),l(),Me(e._timeOptions)}}var rs=[[["","matTimepickerToggleIcon",""]]],ss=["[matTimepickerToggleIcon]"];function ls(i,a){i&1&&(et(),c(0,"svg",1),ne(1,"path",2),p())}var ds=/^(\d*\.?\d+)\s*(h|hour|hours|m|min|minute|minutes|s|second|seconds)?$/i,lo=new B("MAT_TIMEPICKER_CONFIG");function so(i){let a;if(i===null)return null;if(typeof i=="number")a=i;else{if(i.trim().length===0)return null;let e=i.match(ds),t=e?parseFloat(e[1]):null,n=e?.[2]?.toLowerCase()||null;if(!e||t===null||isNaN(t))return null;n==="h"||n==="hour"||n==="hours"?a=t*3600:n==="m"||n==="min"||n==="minute"||n==="minutes"?a=t*60:a=t}return a}function cs(i,a,e,t,n){let o=[],r=i.compareTime(e,t)<1?e:t;for(;i.sameDate(r,e)&&i.compareTime(r,t)<1&&i.isValid(r);)o.push({value:r,label:i.format(r,a.display.timeOptionLabel)}),r=i.addSeconds(r,n);return o}var ps=new B("MAT_TIMEPICKER_SCROLL_STRATEGY",{providedIn:"root",factory:()=>{let i=s(j);return()=>Ne(i)}}),bi=(()=>{class i{_dir=s(le,{optional:!0});_viewContainerRef=s(De);_injector=s(j);_defaultConfig=s(lo,{optional:!0});_dateAdapter=s(U,{optional:!0});_dateFormats=s(Be,{optional:!0});_scrollStrategyFactory=s(ps);_animationsDisabled=we();_isOpen=T(!1);_activeDescendant=T(null);_input=T(null);_overlayRef=null;_portal=null;_optionsCacheKey=null;_localeChanges;_onOpenRender=null;_panelTemplate=it.required("panelTemplate");_timeOptions=[];_options=Oi(cn);_keyManager=new Ui(this._options,this._injector).withHomeAndEnd(!0).withPageUpDown(!0).withVerticalOrientation(!0);interval=Z(so(this._defaultConfig?.interval||null),{transform:so});options=Z(null);isOpen=this._isOpen.asReadonly();selected=Ut();opened=Ut();closed=Ut();activeDescendant=this._activeDescendant.asReadonly();panelId=s(me).getId("mat-timepicker-panel-");disableRipple=Z(this._defaultConfig?.disableRipple??!1,{transform:P});ariaLabel=Z(null,{alias:"aria-label"});ariaLabelledby=Z(null,{alias:"aria-labelledby"});disabled=Ee(()=>!!this._input()?.disabled());panelClass=Z();constructor(){s(A).nativeElement.setAttribute("mat-timepicker-panel-id",this.panelId),this._handleLocaleChanges(),this._handleInputStateChanges(),this._keyManager.change.subscribe(()=>this._activeDescendant.set(this._keyManager.activeItem?.id||null))}open(){let e=this._input();if(!e||(e.focus(),this._isOpen()))return;this._isOpen.set(!0),this._generateOptions();let t=this._getOverlayRef();t.updateSize({width:e.getOverlayOrigin().nativeElement.offsetWidth}),this._portal??=new Ue(this._panelTemplate(),this._viewContainerRef),t.hasAttached()||t.attach(this._portal),this._onOpenRender?.destroy(),this._onOpenRender=ye(()=>{let n=this._options();this._syncSelectedState(e.value(),n,n[0]),this._onOpenRender=null},{injector:this._injector}),this.opened.emit()}close(){this._isOpen()&&(this._isOpen.set(!1),this.closed.emit(),this._animationsDisabled&&this._overlayRef?.detach())}registerInput(e){let t=this._input();this._input.set(e)}ngOnDestroy(){this._keyManager.destroy(),this._localeChanges?.unsubscribe(),this._onOpenRender?.destroy(),this._overlayRef?.dispose()}_getOverlayHost(){return this._overlayRef?.hostElement}_selectValue(e){this.close(),this._keyManager.setActiveItem(e),this._options().forEach(t=>{t!==e&&t.deselect(!1)}),this._input()?.timepickerValueAssigned(e.value),this.selected.emit({value:e.value,source:this}),this._input()?.focus()}_getAriaLabelledby(){return this.ariaLabel()?null:this.ariaLabelledby()||this._input()?.getLabelId()||null}_handleAnimationEnd(e){e.animationName==="_mat-timepicker-exit"&&this._overlayRef?.detach()}_getOverlayRef(){if(this._overlayRef)return this._overlayRef;let e=He(this._injector,this._input().getOverlayOrigin()).withFlexibleDimensions(!1).withPush(!1).withTransformOriginOn(".mat-timepicker-panel").withPopoverLocation("inline").withPositions([{originX:"start",originY:"bottom",overlayX:"start",overlayY:"top"},{originX:"start",originY:"top",overlayX:"start",overlayY:"bottom",panelClass:"mat-timepicker-above"}]);return this._overlayRef=Ye(this._injector,{positionStrategy:e,scrollStrategy:this._scrollStrategyFactory(),direction:this._dir||"ltr",hasBackdrop:!1,disableAnimations:this._animationsDisabled,panelClass:this.panelClass()}),this._overlayRef.detachments().subscribe(()=>this.close()),this._overlayRef.keydownEvents().subscribe(t=>this._handleKeydown(t)),this._overlayRef.outsidePointerEvents().subscribe(t=>{let n=at(t),o=this._input()?.getOverlayOrigin().nativeElement;n&&o&&n!==o&&!o.contains(n)&&this.close()}),this._overlayRef}_generateOptions(){let e=this.interval()??1800,t=this.options();if(t!==null)this._timeOptions=t;else{let n=this._input(),o=this._dateAdapter,r=this._dateFormats.display.timeInput,m=n?.min()||o.setTime(o.today(),0,0,0),g=n?.max()||o.setTime(o.today(),23,59,0),C=e+"/"+o.format(m,r)+"/"+o.format(g,r);C!==this._optionsCacheKey&&(this._optionsCacheKey=C,this._timeOptions=cs(o,this._dateFormats,m,g,e))}}_syncSelectedState(e,t,n){let o=!1;for(let r of t)e&&this._dateAdapter.sameTime(r.value,e)?(r.select(!1),gi(r,"center"),St(()=>this._keyManager.setActiveItem(r)),o=!0):r.deselect(!1);o||(n?(St(()=>this._keyManager.setActiveItem(n)),gi(n,"center")):St(()=>this._keyManager.setActiveItem(-1)))}_handleKeydown(e){let t=e.keyCode;if(t===9)this.close();else if(t===27&&!pe(e))e.preventDefault(),this.close();else if(t===13)e.preventDefault(),this._keyManager.activeItem?this._selectValue(this._keyManager.activeItem):this.close();else{let n=this._keyManager.activeItem;this._keyManager.onKeydown(e);let o=this._keyManager.activeItem;o&&o!==n&&gi(o,"nearest")}}_handleLocaleChanges(){this._localeChanges=this._dateAdapter.localeChanges.subscribe(()=>{this._optionsCacheKey=null,this.isOpen()&&this._generateOptions()})}_handleInputStateChanges(){Ie(()=>{let e=this._input(),t=this._options();this._isOpen()&&e&&this._syncSelectedState(e.value(),t,null)})}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-timepicker"]],viewQuery:function(t,n){t&1&&Yt(n._panelTemplate,ns,5)(n._options,cn,5),t&2&&Mt(2)},inputs:{interval:[1,"interval"],options:[1,"options"],disableRipple:[1,"disableRipple"],ariaLabel:[1,"aria-label","ariaLabel"],ariaLabelledby:[1,"aria-labelledby","ariaLabelledby"],panelClass:[1,"panelClass"]},outputs:{selected:"selected",opened:"opened",closed:"closed"},exportAs:["matTimepicker"],features:[X([{provide:Qi,useExisting:i}])],decls:2,vars:0,consts:[["panelTemplate",""],["role","listbox",1,"mat-timepicker-panel",3,"animationend","id"],[3,"value"],[3,"onSelectionChange","value"]],template:function(t,n){t&1&&Ve(0,os,3,7,"ng-template",null,0,$t)},dependencies:[cn],styles:[`@keyframes _mat-timepicker-enter {
  from {
    opacity: 0;
    transform: scaleY(0.8);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes _mat-timepicker-exit {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}
mat-timepicker {
  display: none;
}

.mat-timepicker-panel {
  width: 100%;
  max-height: 256px;
  transform-origin: center top;
  overflow: auto;
  padding: 8px 0;
  box-sizing: border-box;
  position: relative;
  border-bottom-left-radius: var(--mat-timepicker-container-shape, var(--mat-sys-corner-extra-small));
  border-bottom-right-radius: var(--mat-timepicker-container-shape, var(--mat-sys-corner-extra-small));
  box-shadow: var(--mat-timepicker-container-elevation-shadow, 0px 3px 1px -2px rgba(0, 0, 0, 0.2), 0px 2px 2px 0px rgba(0, 0, 0, 0.14), 0px 1px 5px 0px rgba(0, 0, 0, 0.12));
  background-color: var(--mat-timepicker-container-background-color, var(--mat-sys-surface-container));
}
@media (forced-colors: active) {
  .mat-timepicker-panel {
    outline: solid 1px;
  }
}
.mat-timepicker-above .mat-timepicker-panel {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: var(--mat-timepicker-container-shape, var(--mat-sys-corner-extra-small));
  border-top-right-radius: var(--mat-timepicker-container-shape, var(--mat-sys-corner-extra-small));
}

.mat-timepicker-panel-animations-enabled {
  animation: _mat-timepicker-enter 120ms cubic-bezier(0, 0, 0.2, 1);
}
.mat-timepicker-panel-animations-enabled.mat-timepicker-panel-exit {
  animation: _mat-timepicker-exit 100ms linear;
}

.mat-timepicker-input[readonly] {
  cursor: pointer;
}

@media (forced-colors: active) {
  .mat-timepicker-toggle-default-icon {
    color: CanvasText;
  }
}
`],encapsulation:2,changeDetection:0})}return i})();function gi(i,a){i._getHostElement().scrollIntoView({block:a,inline:a})}var co=(()=>{class i{_elementRef=s(A);_dateAdapter=s(U,{optional:!0});_dateFormats=s(Be,{optional:!0});_formField=s($e,{optional:!0});_onChange;_onTouched;_validatorOnChange;_cleanupClick;_accessorDisabled=T(!1);_localeSubscription;_timepickerSubscription;_validator;_lastValueValid=!0;_minValid=!0;_maxValid=!0;_lastValidDate=null;_ariaActiveDescendant=Ee(()=>{let e=this.timepicker(),t=e.isOpen(),n=e.activeDescendant();return t&&n?n:null});_ariaExpanded=Ee(()=>this.timepicker().isOpen()+"");_ariaControls=Ee(()=>{let e=this.timepicker();return e.isOpen()?e.panelId:null});value=Ri(null);timepicker=Z.required({alias:"matTimepicker"});min=Z(null,{alias:"matTimepickerMin",transform:e=>this._transformDateInput(e)});max=Z(null,{alias:"matTimepickerMax",transform:e=>this._transformDateInput(e)});openOnClick=Z(!0,{alias:"matTimepickerOpenOnClick",transform:P});disabled=Ee(()=>this.disabledInput()||this._accessorDisabled());disabledInput=Z(!1,{transform:P,alias:"disabled"});constructor(){let e=s(Q);this._validator=this._getValidator(),this._updateFormsState(),this._registerTimepicker(),this._localeSubscription=this._dateAdapter.localeChanges.subscribe(()=>{this._hasFocus()||this._formatValue(this.value())}),this._cleanupClick=e.listen(this.getOverlayOrigin().nativeElement,"click",this._handleClick)}writeValue(e){let t=this._dateAdapter.deserialize(e);this.value.set(this._dateAdapter.getValidDateOrNull(t))}registerOnChange(e){this._onChange=e}registerOnTouched(e){this._onTouched=e}setDisabledState(e){this._accessorDisabled.set(e)}validate(e){return this._validator(e)}registerOnValidatorChange(e){this._validatorOnChange=e}getOverlayOrigin(){return this._formField?.getConnectedOverlayOrigin()||this._elementRef}focus(){this._elementRef.nativeElement.focus()}ngOnDestroy(){this._cleanupClick(),this._timepickerSubscription?.unsubscribe(),this._localeSubscription.unsubscribe()}getLabelId(){return this._formField?.getLabelId()||null}_handleClick=e=>{if(this.disabled()||!this.openOnClick())return;let t=at(e),n=this.timepicker()._getOverlayHost();(!t||!n||!n.contains(t))&&this.timepicker().open()};_handleInput(e){let t=e.target.value,n=this.value(),o=this._dateAdapter.parseTime(t,this._dateFormats.parse.timeInput),r=!this._dateAdapter.sameTime(o,n);!o||r||t&&!n?this._assignUserSelection(o,!0):this._validatorOnChange?.()}_handleBlur(){let e=this.value();e&&this._isValid(e)&&this._formatValue(e),this.timepicker().isOpen()||this._onTouched?.()}_handleKeydown(e){this.timepicker().isOpen()||this.disabled()||(e.keyCode===27&&!pe(e)&&this.value()!==null?(e.preventDefault(),this.value.set(null),this._formatValue(null)):(e.keyCode===40||e.keyCode===38)&&(e.preventDefault(),this.timepicker().open()))}timepickerValueAssigned(e){this._dateAdapter.sameTime(e,this.value())||(this._assignUserSelection(e,!0),this._formatValue(e))}_updateFormsState(){Ie(()=>{let{_dateAdapter:e,_lastValueValid:t,_minValid:n,_maxValid:o}=this,r=e.deserialize(this.value()),m=this.min(),g=this.max(),C=this._lastValueValid=this._isValid(r);this._minValid=!m||!r||!C||e.compareTime(m,r)<=0,this._maxValid=!g||!r||!C||e.compareTime(g,r)>=0;let x=t!==C||n!==this._minValid||o!==this._maxValid;this._hasFocus()||this._formatValue(r),r&&C&&(this._lastValidDate=r),x&&this._validatorOnChange?.()})}_registerTimepicker(){Ie(()=>{let e=this.timepicker();e.registerInput(this),e.closed.subscribe(()=>this._onTouched?.())})}_assignUserSelection(e,t){let n;if(e==null||!this._isValid(e))n=e;else{let o=this._dateAdapter,r=o.getValidDateOrNull(this._lastValidDate||this.value()),m=o.getHours(e),g=o.getMinutes(e),C=o.getSeconds(e);n=r?o.setTime(r,m,g,C):e}t&&this._onChange?.(n),this.value.set(n)}_formatValue(e){e=this._dateAdapter.getValidDateOrNull(e),this._elementRef.nativeElement.value=e==null?"":this._dateAdapter.format(e,this._dateFormats.display.timeInput)}_isValid(e){return!e||this._dateAdapter.isValid(e)}_transformDateInput(e){let t=typeof e=="string"?this._dateAdapter.parseTime(e,this._dateFormats.parse.timeInput):this._dateAdapter.deserialize(e);return t&&this._dateAdapter.isValid(t)?t:null}_hasFocus(){return Et()===this._elementRef.nativeElement}_getValidator(){return Le.compose([()=>this._lastValueValid?null:{matTimepickerParse:{text:this._elementRef.nativeElement.value}},e=>this._minValid?null:{matTimepickerMin:{min:this.min(),actual:this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value))}},e=>this._maxValid?null:{matTimepickerMax:{max:this.max(),actual:this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value))}}])}static \u0275fac=function(t){return new(t||i)};static \u0275dir=I({type:i,selectors:[["input","matTimepicker",""]],hostAttrs:["role","combobox","type","text","aria-haspopup","listbox",1,"mat-timepicker-input"],hostVars:5,hostBindings:function(t,n){if(t&1&&f("blur",function(){return n._handleBlur()})("input",function(r){return n._handleInput(r)})("keydown",function(r){return n._handleKeydown(r)}),t&2){let o;se("disabled",n.disabled()),w("aria-activedescendant",n._ariaActiveDescendant())("aria-expanded",n._ariaExpanded())("aria-controls",n._ariaControls())("mat-timepicker-id",(o=n.timepicker())==null?null:o.panelId)}},inputs:{value:[1,"value"],timepicker:[1,"matTimepicker","timepicker"],min:[1,"matTimepickerMin","min"],max:[1,"matTimepickerMax","max"],openOnClick:[1,"matTimepickerOpenOnClick","openOnClick"],disabledInput:[1,"disabled","disabledInput"]},outputs:{value:"valueChange"},exportAs:["matTimepickerInput"],features:[X([{provide:qe,useExisting:i,multi:!0},{provide:mt,useExisting:i,multi:!0},{provide:gt,useExisting:i}])]})}return i})(),ms=(()=>{class i{_defaultConfig=s(lo,{optional:!0});_defaultTabIndex=(()=>{let e=s(new Xt("tabindex"),{optional:!0}),t=Number(e);return isNaN(t)?null:t})();_isDisabled=Ee(()=>{let e=this.timepicker();return this.disabled()||e.disabled()});timepicker=Z.required({alias:"for"});ariaLabel=Z(void 0,{alias:"aria-label"});ariaLabelledby=Z(void 0,{alias:"aria-labelledby"});_defaultAriaLabel="Open timepicker options";disabled=Z(!1,{transform:P,alias:"disabled"});tabIndex=Z(this._defaultTabIndex);disableRipple=Z(this._defaultConfig?.disableRipple??!1,{transform:P});_open(e){this.timepicker()&&!this._isDisabled()&&(this.timepicker().open(),e.stopPropagation())}getAriaLabel(){return this.ariaLabelledby()?null:this.ariaLabel()||this._defaultAriaLabel}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=E({type:i,selectors:[["mat-timepicker-toggle"]],hostAttrs:[1,"mat-timepicker-toggle"],hostVars:1,hostBindings:function(t,n){t&1&&f("click",function(r){return n._open(r)}),t&2&&w("tabindex",null)},inputs:{timepicker:[1,"for","timepicker"],ariaLabel:[1,"aria-label","ariaLabel"],ariaLabelledby:[1,"aria-labelledby","ariaLabelledby"],disabled:[1,"disabled"],tabIndex:[1,"tabIndex"],disableRipple:[1,"disableRipple"]},exportAs:["matTimepickerToggle"],ngContentSelectors:ss,decls:3,vars:6,consts:[["matIconButton","","type","button","aria-haspopup","listbox",3,"tabIndex","disabled","disableRipple"],["height","24px","width","24px","viewBox","0 -960 960 960","fill","currentColor","focusable","false","aria-hidden","true",1,"mat-timepicker-toggle-default-icon"],["d","m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"]],template:function(t,n){t&1&&(ie(rs),c(0,"button",0),z(1,0,null,ls,2,0),p()),t&2&&(b("tabIndex",n._isDisabled()?-1:n.tabIndex())("disabled",n._isDisabled())("disableRipple",n.disableRipple()),w("aria-label",n.getAriaLabel())("aria-labelledby",n.ariaLabelledby())("aria-expanded",n.timepicker().isOpen()))},dependencies:[ut],encapsulation:2,changeDetection:0})}return i})(),po=(()=>{class i{static \u0275fac=function(t){return new(t||i)};static \u0275mod=$({type:i});static \u0275inj=q({imports:[bi,ms,ot]})}return i})();function bs(i,a){i&1&&(c(0,"strong"),_(1,"*"),p())}function vs(i,a){if(i&1&&(c(0,"span",13),_(1),v(2,bs,2,0,"strong"),p()),i&2){let e=d(2);l(),k(e.label),l(),y(e.required?2:-1)}}function ys(i,a){if(i&1){let e=R();c(0,"div",8)(1,"label",12),v(2,vs,3,2,"span",13),c(3,"div",14)(4,"mat-form-field",15)(5,"input",16),f("ngModelChange",function(n){u(e);let o=d();return h(o.onTimeOnlyChange(n))})("blur",function(){u(e);let n=d();return h(n.markTouched())}),p(),c(6,"button",17),f("mousedown",function(n){return n.preventDefault()})("click",function(n){u(e);let o=W(10),r=d();return h(r.toggleTimePicker(o,"time",n))}),c(7,"mat-icon"),_(8),p()(),c(9,"mat-timepicker",18,0),f("opened",function(){u(e);let n=d();return h(n.setPickerOpen("time",!0))})("closed",function(){u(e);let n=d();return h(n.setPickerOpen("time",!1))}),p()()()()()}if(i&2){let e=W(10),t=d();l(2),y(t.label?2:-1),l(3),b("matTimepicker",e)("matTimepickerOpenOnClick",!0)("ngModel",t.singleTimeValue)("disabled",t.inputDisabled()),l(),D("date-input__toggle--open",t.isPickerOpen("time")),b("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("time")),l(2),k(t.pickerIcon("time","schedule"))}}function xs(i,a){if(i&1){let e=R();c(0,"div",9)(1,"label",12)(2,"div",14)(3,"mat-form-field",19)(4,"mat-date-range-input",20)(5,"input",21),f("ngModelChange",function(n){u(e);let o=d();return h(o.onStartDateChange(n))})("blur",function(){u(e);let n=d();return h(n.markTouched())}),p(),c(6,"input",22),f("ngModelChange",function(n){u(e);let o=d();return h(o.onEndDateChange(n))})("blur",function(){u(e);let n=d();return h(n.markTouched())}),p()(),c(7,"button",23),f("mousedown",function(n){return n.preventDefault()})("click",function(n){u(e);let o=W(11),r=d();return h(r.toggleDateRangePicker(o,"range-date",n))}),c(8,"mat-icon"),_(9),p()(),c(10,"mat-date-range-picker",18,1),f("opened",function(){u(e);let n=d();return h(n.setPickerOpen("range-date",!0))})("closed",function(){u(e);let n=d();return h(n.setPickerOpen("range-date",!1))}),p()()()()()}if(i&2){let e=W(11),t=d();l(4),b("rangePicker",e),l(),b("ngModel",t.startDateValue)("min",t.resolvedStartMin())("max",t.resolvedStartMax())("disabled",t.inputDisabled())("placeholder",t.startPlaceholder),w("aria-label",t.startLabel),l(),b("ngModel",t.endDateValue)("min",t.resolvedEndMin())("max",t.resolvedEndMax())("disabled",t.inputDisabled())("placeholder",t.endPlaceholder),w("aria-label",t.endLabel),l(),D("date-input__toggle--open",t.isPickerOpen("range-date")),b("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("range-date")),l(2),k(t.pickerIcon("range-date","calendar_month"))}}function Cs(i,a){i&1&&(c(0,"strong"),_(1,"*"),p())}function ws(i,a){if(i&1){let e=R();c(0,"mat-form-field",15)(1,"input",16),f("ngModelChange",function(n){u(e);let o=d(2);return h(o.onStartTimeChange(n))})("blur",function(){u(e);let n=d(2);return h(n.markTouched())}),p(),c(2,"button",29),f("mousedown",function(n){return n.preventDefault()})("click",function(n){u(e);let o=W(6),r=d(2);return h(r.toggleTimePicker(o,"start-time",n))}),c(3,"mat-icon"),_(4),p()(),c(5,"mat-timepicker",18,4),f("opened",function(){u(e);let n=d(2);return h(n.setPickerOpen("start-time",!0))})("closed",function(){u(e);let n=d(2);return h(n.setPickerOpen("start-time",!1))}),p()()}if(i&2){let e=W(6),t=d(2);l(),b("matTimepicker",e)("matTimepickerOpenOnClick",!0)("ngModel",t.startTimeValue)("disabled",t.inputDisabled()),l(),D("date-input__toggle--open",t.isPickerOpen("start-time")),b("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("start-time")),l(2),k(t.pickerIcon("start-time","schedule"))}}function Ds(i,a){i&1&&(c(0,"strong"),_(1,"*"),p())}function ks(i,a){if(i&1){let e=R();c(0,"mat-form-field",15)(1,"input",16),f("ngModelChange",function(n){u(e);let o=d(2);return h(o.onEndTimeChange(n))})("blur",function(){u(e);let n=d(2);return h(n.markTouched())}),p(),c(2,"button",30),f("mousedown",function(n){return n.preventDefault()})("click",function(n){u(e);let o=W(6),r=d(2);return h(r.toggleTimePicker(o,"end-time",n))}),c(3,"mat-icon"),_(4),p()(),c(5,"mat-timepicker",18,5),f("opened",function(){u(e);let n=d(2);return h(n.setPickerOpen("end-time",!0))})("closed",function(){u(e);let n=d(2);return h(n.setPickerOpen("end-time",!1))}),p()()}if(i&2){let e=W(6),t=d(2);l(),b("matTimepicker",e)("matTimepickerOpenOnClick",!0)("ngModel",t.endTimeValue)("disabled",t.inputDisabled()),l(),D("date-input__toggle--open",t.isPickerOpen("end-time")),b("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("end-time")),l(2),k(t.pickerIcon("end-time","schedule"))}}function Ms(i,a){if(i&1){let e=R();c(0,"div",24)(1,"label",12)(2,"span",13),_(3),v(4,Cs,2,0,"strong"),p(),c(5,"div",14)(6,"mat-form-field",25)(7,"input",26),f("ngModelChange",function(n){u(e);let o=d();return h(o.onStartDateChange(n))})("blur",function(){u(e);let n=d();return h(n.markTouched())}),p(),c(8,"button",27),f("mousedown",function(n){return n.preventDefault()})("click",function(n){u(e);let o=W(12),r=d();return h(r.toggleDatePicker(o,"start-date",n))}),c(9,"mat-icon"),_(10),p()(),c(11,"mat-datepicker",18,2),f("opened",function(){u(e);let n=d();return h(n.setPickerOpen("start-date",!0))})("closed",function(){u(e);let n=d();return h(n.setPickerOpen("start-date",!1))}),p()(),v(13,ws,7,9,"mat-form-field",15),p()(),c(14,"label",12)(15,"span",13),_(16),v(17,Ds,2,0,"strong"),p(),c(18,"div",14)(19,"mat-form-field",25)(20,"input",26),f("ngModelChange",function(n){u(e);let o=d();return h(o.onEndDateChange(n))})("blur",function(){u(e);let n=d();return h(n.markTouched())}),p(),c(21,"button",28),f("mousedown",function(n){return n.preventDefault()})("click",function(n){u(e);let o=W(25),r=d();return h(r.toggleDatePicker(o,"end-date",n))}),c(22,"mat-icon"),_(23),p()(),c(24,"mat-datepicker",18,3),f("opened",function(){u(e);let n=d();return h(n.setPickerOpen("end-date",!0))})("closed",function(){u(e);let n=d();return h(n.setPickerOpen("end-date",!1))}),p()(),v(26,ks,7,9,"mat-form-field",15),p()()()}if(i&2){let e=W(12),t=W(25),n=d();D("date-input--with-time",n.hasTime()),l(3),k(n.startLabel),l(),y(n.startRequired?4:-1),l(3),b("matDatepicker",e)("ngModel",n.startDateValue)("min",n.resolvedStartMin())("max",n.resolvedStartMax())("disabled",n.inputDisabled())("placeholder",n.startPlaceholder),l(),D("date-input__toggle--open",n.isPickerOpen("start-date")),b("disabled",n.inputDisabled()),w("aria-pressed",n.isPickerOpen("start-date")),l(2),k(n.pickerIcon("start-date","calendar_month")),l(3),y(n.hasTime()?13:-1),l(3),k(n.endLabel),l(),y(n.endRequired?17:-1),l(3),b("matDatepicker",t)("ngModel",n.endDateValue)("min",n.resolvedEndMin())("max",n.resolvedEndMax())("disabled",n.inputDisabled())("placeholder",n.endPlaceholder),l(),D("date-input__toggle--open",n.isPickerOpen("end-date")),b("disabled",n.inputDisabled()),w("aria-pressed",n.isPickerOpen("end-date")),l(2),k(n.pickerIcon("end-date","calendar_month")),l(3),y(n.hasTime()?26:-1)}}function Ss(i,a){i&1&&(c(0,"strong"),_(1,"*"),p())}function Es(i,a){if(i&1&&(c(0,"span",13),_(1),v(2,Ss,2,0,"strong"),p()),i&2){let e=d(2);l(),k(e.label),l(),y(e.required?2:-1)}}function As(i,a){if(i&1){let e=R();c(0,"mat-form-field",15)(1,"input",16),f("ngModelChange",function(n){u(e);let o=d(2);return h(o.onSingleTimeChange(n))})("blur",function(){u(e);let n=d(2);return h(n.markTouched())}),p(),c(2,"button",17),f("mousedown",function(n){return n.preventDefault()})("click",function(n){u(e);let o=W(6),r=d(2);return h(r.toggleTimePicker(o,"single-time",n))}),c(3,"mat-icon"),_(4),p()(),c(5,"mat-timepicker",18,7),f("opened",function(){u(e);let n=d(2);return h(n.setPickerOpen("single-time",!0))})("closed",function(){u(e);let n=d(2);return h(n.setPickerOpen("single-time",!1))}),p()()}if(i&2){let e=W(6),t=d(2);l(),b("matTimepicker",e)("matTimepickerOpenOnClick",!0)("ngModel",t.singleTimeValue)("disabled",t.inputDisabled()),l(),D("date-input__toggle--open",t.isPickerOpen("single-time")),b("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("single-time")),l(2),k(t.pickerIcon("single-time","schedule"))}}function Ps(i,a){if(i&1&&(c(0,"span",34),_(1),p()),i&2){let e=d(3);l(),k(e.metaLabel())}}function Ts(i,a){if(i&1&&(c(0,"span",36),_(1),p()),i&2){let e=d(3);l(),k(e.metaIcon())}}function Os(i,a){if(i&1&&(c(0,"div",33),v(1,Ps,2,1,"span",34),c(2,"span",35),v(3,Ts,2,1,"span",36),c(4,"span"),_(5),p()()()),i&2){let e=d(2);l(),y(e.metaLabel()?1:-1),l(),b("ngClass","date-input__meta-badge--"+e.metaPalette()),l(),y(e.metaIcon()?3:-1),l(2),k(e.metaValue())}}function Is(i,a){if(i&1){let e=R();c(0,"div",31)(1,"label",12),v(2,Es,3,2,"span",13),c(3,"div",14)(4,"mat-form-field",25)(5,"input",26),f("ngModelChange",function(n){u(e);let o=d();return h(o.onSingleDateChange(n))})("blur",function(){u(e);let n=d();return h(n.markTouched())}),p(),c(6,"button",32),f("mousedown",function(n){return n.preventDefault()})("click",function(n){u(e);let o=W(10),r=d();return h(r.toggleDatePicker(o,"single-date",n))}),c(7,"mat-icon"),_(8),p()(),c(9,"mat-datepicker",18,6),f("opened",function(){u(e);let n=d();return h(n.setPickerOpen("single-date",!0))})("closed",function(){u(e);let n=d();return h(n.setPickerOpen("single-date",!1))}),p()(),v(11,As,7,9,"mat-form-field",15),p()(),v(12,Os,6,4,"div",33),p()}if(i&2){let e=W(10),t=d();D("date-input--with-time",t.hasTime())("date-input--with-meta",t.hasMeta()),l(2),y(t.label?2:-1),l(3),b("matDatepicker",e)("ngModel",t.singleDateValue)("min",t.resolvedSingleMin())("max",t.resolvedSingleMax())("disabled",t.inputDisabled())("placeholder",t.placeholder),l(),D("date-input__toggle--open",t.isPickerOpen("single-date")),b("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("single-date")),l(2),k(t.pickerIcon("single-date","calendar_month")),l(3),y(t.hasTime()?11:-1),l(),y(t.hasMeta()?12:-1)}}var Tn=class i{constructor(a){this.cdr=a}model=null;get compactRangeHost(){return this.isCompactRange()}static horoscopeMetaBySign={Aries:{label:"Kos",icon:"\u2648",palette:"aries"},Taurus:{label:"Bika",icon:"\u2649",palette:"taurus"},Gemini:{label:"Ikrek",icon:"\u264A",palette:"gemini"},Cancer:{label:"R\xE1k",icon:"\u264B",palette:"cancer"},Leo:{label:"Oroszl\xE1n",icon:"\u264C",palette:"leo"},Virgo:{label:"Sz\u0171z",icon:"\u264D",palette:"virgo"},Libra:{label:"M\xE9rleg",icon:"\u264E",palette:"libra"},Scorpio:{label:"Skorpi\xF3",icon:"\u264F",palette:"scorpio"},Sagittarius:{label:"Nyilas",icon:"\u2650",palette:"sagittarius"},Capricorn:{label:"Bak",icon:"\u2651",palette:"capricorn"},Aquarius:{label:"V\xEDz\xF6nt\u0151",icon:"\u2652",palette:"aquarius"},Pisces:{label:"Halak",icon:"\u2653",palette:"pisces"}};singleDateValue=null;singleTimeValue=null;startDateValue=null;startTimeValue=null;endDateValue=null;endTimeValue=null;openPickers=new Set;controlDisabled=!1;currentValue=null;onValueChange=()=>{};onTouched=()=>{};writeValue(a){this.currentValue=a??null,this.syncControlsFromValue(),this.cdr.markForCheck()}registerOnChange(a){this.onValueChange=a}registerOnTouched(a){this.onTouched=a}setDisabledState(a){this.controlDisabled=a,this.cdr.markForCheck()}isRange(){return this.mode==="range"}isCompactRange(){return this.isRange()&&this.rangeLayout==="compact"&&!this.hasTime()}isTimeOnly(){return this.mode==="time"}hasTime(){return this.precision==="minute"}inputDisabled(){return this.disabled||this.readOnly||this.controlDisabled}get label(){return`${this.singleField.label??""}`}get startLabel(){return`${this.startField.label??"Start"}`}get endLabel(){return`${this.endField.label??"End"}`}get placeholder(){return`${this.singleField.placeholder??"YYYY/MM/DD"}`}get startPlaceholder(){return`${this.startField.placeholder??"YYYY/MM/DD"}`}get endPlaceholder(){return`${this.endField.placeholder??"YYYY/MM/DD"}`}get required(){return this.singleField.required===!0}get startRequired(){return this.startField.required===!0}get endRequired(){return this.endField.required===!0}get mode(){return this.model?.mode??"single"}get precision(){return this.model?.precision??"date"}get valueFormat(){return this.model?.valueFormat??"iso-date-time"}get readOnly(){return this.model?.readOnly===!0}get disabled(){return this.model?.disabled===!0}get singleField(){return this.model?.field??{}}get range(){return this.model?.range??{}}get rangeLayout(){return this.range.layout??"split"}get startField(){return this.range.start??{}}get endField(){return this.range.end??{}}get bounds(){return this.range.bounds}get allowEndBeforeStart(){return this.range.allowEndBeforeStart===!0}get meta(){return this.model?.meta}resolvedSingleMin(){return this.toDatePickerBoundary(this.singleField.min)}resolvedSingleMax(){return this.toDatePickerBoundary(this.singleField.max)}resolvedStartMin(){return this.toDatePickerBoundary(this.bounds?.start??this.startField.min)}resolvedStartMax(){return this.toDatePickerBoundary(this.bounds?.end??this.startField.max)}resolvedEndMin(){return this.toDatePickerBoundary(this.allowEndBeforeStart?this.bounds?.start??this.endField.min:this.startDateValue??this.bounds?.start??this.endField.min)}resolvedEndMax(){return this.toDatePickerBoundary(this.bounds?.end??this.endField.max)}onSingleDateChange(a){this.singleDateValue=a,this.emitSingleValue()}onSingleTimeChange(a){this.singleTimeValue=a,this.emitSingleValue()}onTimeOnlyChange(a){this.singleTimeValue=a,this.emitTimeOnlyValue()}onStartDateChange(a){this.startDateValue=a,this.emitRangeValue()}onStartTimeChange(a){this.startTimeValue=a,this.emitRangeValue()}onEndDateChange(a){this.endDateValue=a,this.emitRangeValue()}onEndTimeChange(a){this.endTimeValue=a,this.emitRangeValue()}markTouched(){this.onTouched()}isPickerOpen(a){return this.openPickers.has(a)}pickerIcon(a,e){return this.isPickerOpen(a)?"close":e}hasMeta(){return this.meta!==null&&this.meta!==void 0}metaLabel(){return`${this.meta?.label??""}`.trim()}metaIcon(){return this.resolvedMetaValue()?.icon?.trim()||`${this.meta?.icon??""}`.trim()}metaValue(){return`${this.resolvedMetaValue()?.label??""}`.trim()||`${this.meta?.emptyLabel??""}`.trim()}metaPalette(){return this.resolvedMetaValue()?.palette?.trim()||`${this.meta?.palette??"blue"}`.trim()||"blue"}setPickerOpen(a,e){e?this.openPickers.add(a):this.openPickers.delete(a),this.cdr.markForCheck()}toggleDatePicker(a,e,t){if(t.preventDefault(),t.stopPropagation(),!this.inputDisabled()){if(a.opened||this.isPickerOpen(e)){a.close();return}a.open()}}toggleDateRangePicker(a,e,t){if(t.preventDefault(),t.stopPropagation(),!this.inputDisabled()){if(a.opened||this.isPickerOpen(e)){a.close();return}a.open()}}toggleTimePicker(a,e,t){if(t.preventDefault(),t.stopPropagation(),!this.inputDisabled()){if(this.isPickerOpen(e)){a.close();return}a.open()}}emitSingleValue(){if(this.inputDisabled())return;let a=this.datePartsToValue(this.singleDateValue,this.singleTimeValue);this.currentValue=a,this.onValueChange(a),this.onTouched()}emitTimeOnlyValue(){if(this.inputDisabled())return;let a=this.timeToValue(this.singleTimeValue);this.currentValue=a,this.onValueChange(a),this.onTouched()}emitRangeValue(){if(this.inputDisabled())return;let a={startAt:this.datePartsToValue(this.startDateValue,this.startTimeValue),endAt:this.datePartsToValue(this.endDateValue,this.endTimeValue),precision:this.precision},e=this.normalizedRange(a);this.currentValue=e,this.syncControlsFromValue(),this.onValueChange(e),this.onTouched()}syncControlsFromValue(){if(this.mode==="time"){let e=typeof this.currentValue=="string"?this.toTimeDate(this.currentValue):null;this.singleDateValue=null,this.singleTimeValue=e;return}if(this.mode==="range"){let e=this.isRangeValue(this.currentValue)?this.currentValue:{startAt:"",endAt:"",precision:this.precision},t=this.toDate(e.startAt),n=this.toDate(e.endAt);this.startDateValue=t,this.startTimeValue=t,this.endDateValue=n,this.endTimeValue=n;return}let a=typeof this.currentValue=="string"?this.toDate(this.currentValue):null;this.singleDateValue=a,this.singleTimeValue=a}timeToValue(a){return a?`${a.getHours()}`.padStart(2,"0")+":"+`${a.getMinutes()}`.padStart(2,"0"):""}toTimeDate(a){if(a instanceof Date)return Number.isFinite(a.getTime())?new Date(a):null;let t=`${a??""}`.trim().match(/^(\d{1,2}):(\d{2})$/);if(!t)return null;let n=Number(t[1]),o=Number(t[2]);if(!Number.isInteger(n)||!Number.isInteger(o)||n<0||n>23||o<0||o>59)return null;let r=new Date;return r.setHours(n,o,0,0),r}datePartsToValue(a,e){if(!a)return"";let t=new Date(a);if(this.precision==="minute"){let n=e??a;return t.setHours(n.getHours(),n.getMinutes(),0,0),Fe.toIsoDateTimeLocal(t)}return t.setHours(0,0,0,0),this.valueFormat==="iso-date"?Fe.toIsoDate(t):Fe.toIsoDateTimeLocal(t)}toDate(a){if(a instanceof Date)return Number.isFinite(a.getTime())?new Date(a):null;let e=`${a??""}`.trim();if(!e)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(e)){let[t,n,o]=e.split("-").map(m=>Number.parseInt(m,10)),r=new Date(t,n-1,o,0,0,0,0);return Number.isFinite(r.getTime())?r:null}return Fe.isoLocalDateTimeToDate(e)}toDatePickerBoundary(a){let e=this.toDate(a);return e?new Date(e.getFullYear(),e.getMonth(),e.getDate(),0,0,0,0):null}normalizedRange(a){let e=this.toDate(a.startAt),t=this.toDate(a.endAt),n=this.toDate(this.bounds?.start??this.startField.min),o=this.toDate(this.bounds?.end??this.endField.max);if(!e)return{startAt:"",endAt:"",precision:this.precision};let r=new Date(e);n&&r.getTime()<n.getTime()&&(r=new Date(n)),o&&r.getTime()>o.getTime()&&(r=new Date(o));let m=3600*1e3;return(!t||!this.allowEndBeforeStart&&t.getTime()<=r.getTime())&&(t=new Date(r.getTime()+m)),o&&t.getTime()>o.getTime()&&(t=new Date(o)),!this.allowEndBeforeStart&&t.getTime()<=r.getTime()&&(r=n&&o&&o.getTime()>n.getTime()?new Date(Math.max(n.getTime(),o.getTime()-m)):r,t=o&&o.getTime()>r.getTime()?new Date(o):new Date(r.getTime()+m)),{startAt:this.dateToValue(r),endAt:this.dateToValue(t),precision:this.precision}}dateToValue(a){if(this.precision==="minute")return Fe.toIsoDateTimeLocal(a);let e=new Date(a);return e.setHours(0,0,0,0),this.valueFormat==="iso-date"?Fe.toIsoDate(e):Fe.toIsoDateTimeLocal(e)}isRangeValue(a){return!!a&&typeof a=="object"&&"startAt"in a&&"endAt"in a}resolvedMetaValue(){return this.meta?this.meta.kind==="horoscope"?this.horoscopeMetaValue():{label:this.meta.emptyLabel??"",icon:this.meta.icon??"",palette:this.meta.palette??"blue"}:null}horoscopeMetaValue(){let a=this.singleDateValue??(typeof this.currentValue=="string"?this.toDate(this.currentValue):null);if(!a)return null;let e=Fe.horoscopeByDate(a);return i.horoscopeMetaBySign[e]??i.horoscopeMetaBySign.Pisces}static \u0275fac=function(e){return new(e||i)(Mi(ee))};static \u0275cmp=E({type:i,selectors:[["app-date-input"]],hostVars:2,hostBindings:function(e,t){e&2&&D("date-input-host--range-compact",t.compactRangeHost)},inputs:{model:"model"},features:[X([{provide:qe,useExisting:pt(()=>i),multi:!0}])],decls:4,vars:1,consts:[["timeOnlyPicker",""],["rangePicker",""],["startPicker",""],["endPicker",""],["startTimePicker",""],["endTimePicker",""],["singlePicker",""],["singleTimePicker",""],[1,"date-input","date-input--time"],[1,"date-input","date-input--range-compact"],[1,"date-input","date-input--range",3,"date-input--with-time"],[1,"date-input","date-input--single",3,"date-input--with-time","date-input--with-meta"],[1,"date-input__field"],[1,"date-input__label"],[1,"date-input__row"],["appearance","outline","subscriptSizing","dynamic",1,"date-input__material","date-input__material--time"],["matInput","",3,"ngModelChange","blur","matTimepicker","matTimepickerOpenOnClick","ngModel","disabled"],["matSuffix","","type","button","aria-label","Toggle time picker",1,"date-input__toggle",3,"mousedown","click","disabled"],[3,"opened","closed"],["appearance","outline","subscriptSizing","dynamic",1,"date-input__material","date-input__material--range"],[3,"rangePicker"],["matStartDate","",3,"ngModelChange","blur","ngModel","min","max","disabled","placeholder"],["matEndDate","",3,"ngModelChange","blur","ngModel","min","max","disabled","placeholder"],["matSuffix","","type","button","aria-label","Toggle date range picker",1,"date-input__toggle",3,"mousedown","click","disabled"],[1,"date-input","date-input--range"],["appearance","outline","subscriptSizing","dynamic",1,"date-input__material","date-input__material--date"],["matInput","",3,"ngModelChange","blur","matDatepicker","ngModel","min","max","disabled","placeholder"],["matSuffix","","type","button","aria-label","Toggle start date picker",1,"date-input__toggle",3,"mousedown","click","disabled"],["matSuffix","","type","button","aria-label","Toggle end date picker",1,"date-input__toggle",3,"mousedown","click","disabled"],["matSuffix","","type","button","aria-label","Toggle start time picker",1,"date-input__toggle",3,"mousedown","click","disabled"],["matSuffix","","type","button","aria-label","Toggle end time picker",1,"date-input__toggle",3,"mousedown","click","disabled"],[1,"date-input","date-input--single"],["matSuffix","","type","button","aria-label","Toggle date picker",1,"date-input__toggle",3,"mousedown","click","disabled"],[1,"date-input__meta"],[1,"date-input__meta-label"],[1,"date-input__meta-badge",3,"ngClass"],[1,"date-input__meta-icon"]],template:function(e,t){e&1&&v(0,ys,11,10,"div",8)(1,xs,12,18,"div",9)(2,Ms,27,30,"div",10)(3,Is,13,18,"div",11),e&2&&y(t.isTimeOnly()?0:t.isCompactRange()?1:t.isRange()?2:3)},dependencies:[Gt,Kt,nn,Ni,Qt,en,no,Ka,Pn,_i,Ja,eo,to,Ft,un,Kn,rn,on,ro,oo,ta,po,bi,co],styles:['[_nghost-%COMP%]{display:block;grid-column:1/-1;width:100%;min-width:0}.date-input-host--range-compact[_nghost-%COMP%]{--date-input-compact-control-width: 236px;--date-input-compact-shell-height: 34px;--date-input-compact-chip-height: 26px;--date-input-compact-chip-width: 10ch;grid-column:auto;width:var(--date-input-compact-control-width);min-width:var(--date-input-compact-control-width);max-width:var(--date-input-compact-control-width);flex:0 0 var(--date-input-compact-control-width);overflow:visible}.date-input[_ngcontent-%COMP%]{display:grid;gap:.62rem;width:100%}.date-input--range[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;gap:.72rem}.date-input--range-compact[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr);gap:0}.date-input--range-compact[_ngcontent-%COMP%]   .date-input__field[_ngcontent-%COMP%], .date-input--range-compact[_ngcontent-%COMP%]   .date-input__row[_ngcontent-%COMP%]{gap:0}.date-input--single.date-input--with-meta[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) max-content;align-items:end}.date-input--time[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr)}.date-input__field[_ngcontent-%COMP%]{display:grid;gap:.34rem;min-width:0}.date-input__label[_ngcontent-%COMP%]{display:inline-flex;align-items:center;gap:.18rem;color:#203a5d;font-weight:700;font-size:.84rem;line-height:1.2}.date-input__label[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%]{color:#cf283f;font-weight:800}.date-input__row[_ngcontent-%COMP%]{display:grid;grid-template-columns:minmax(0,1fr);align-items:center;gap:.5rem;min-width:0}.date-input--with-time[_ngcontent-%COMP%]   .date-input__row[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) minmax(132px,148px)}.date-input__material[_ngcontent-%COMP%]{width:100%;min-width:0}[_nghost-%COMP%]     .date-input__material .mat-mdc-text-field-wrapper{min-height:38px;height:38px;padding:0 .48rem 0 .72rem;border:1px solid rgba(112,143,184,.56);border-radius:10px;background:#fff!important;box-shadow:none}[_nghost-%COMP%]     .date-input__material .mat-mdc-text-field-wrapper.mdc-text-field{background-color:#fff!important}[_nghost-%COMP%]     .date-input__material.mat-focused .mat-mdc-text-field-wrapper{border-color:#3872bed1;box-shadow:0 0 0 3px #3872be1a}[_nghost-%COMP%]     .date-input__material .mdc-text-field, [_nghost-%COMP%]     .date-input__material .mdc-text-field--filled{background:transparent}[_nghost-%COMP%]     .date-input__material .mdc-notched-outline__leading, [_nghost-%COMP%]     .date-input__material .mdc-notched-outline__notch, [_nghost-%COMP%]     .date-input__material .mdc-notched-outline__trailing{border:0}[_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-flex{min-height:36px;align-items:center}[_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-infix{width:auto;min-height:0;padding:0}[_nghost-%COMP%]     .date-input__material .mat-mdc-input-element{color:#183358;font-size:.92rem;line-height:1.2;min-width:0}[_nghost-%COMP%]     .date-input__material .mat-mdc-input-element:focus, [_nghost-%COMP%]     .date-input__material .mat-mdc-input-element:focus-visible{outline:none;box-shadow:none}[_nghost-%COMP%]     .date-input__material .mat-mdc-input-element::placeholder{color:#2d446185}[_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-subscript-wrapper, [_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-bottom-align, [_nghost-%COMP%]     .date-input__material .mdc-line-ripple, [_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-line-ripple, [_nghost-%COMP%]     .date-input__material .mdc-line-ripple--deactivating, [_nghost-%COMP%]     .date-input__material .mdc-line-ripple--active{display:none}[_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-icon-suffix{align-self:stretch;display:inline-flex;align-items:center;padding:0}[_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-container{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);min-height:36px;height:36px;align-items:center;color:#183358}[_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-wrapper, [_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-start-wrapper, [_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-end-wrapper{display:flex;align-items:center;min-width:0;min-height:36px;height:36px;overflow:hidden}[_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-inner{color:#183358;font-size:.92rem;box-sizing:border-box;width:100%;height:100%;margin:0;padding:0;line-height:normal;min-width:0}[_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-inner::placeholder{color:#2d446185}[_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-separator{margin:0 .22rem;color:#2d44619e}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-text-field-wrapper{min-height:var(--date-input-compact-shell-height);height:var(--date-input-compact-shell-height);padding:0 .22rem 0 .46rem;border-color:#2a538d42;border-radius:999px;background:#f7fbff!important;overflow:visible}[_nghost-%COMP%]     .date-input--range-compact .date-input__material.mat-focused .mat-mdc-text-field-wrapper{border-color:#3872bebd;box-shadow:0 0 0 3px #3872be1a}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-flex, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-infix, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-start-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-end-wrapper{min-width:0;min-height:var(--date-input-compact-shell-height);height:var(--date-input-compact-shell-height);overflow:hidden;border-bottom:0!important;box-shadow:none!important}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-flex, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-start-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-end-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-mirror{display:flex;align-items:center}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-infix{width:auto!important;flex:1 1 auto;padding-top:0!important;padding-bottom:0!important}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-focus-overlay{background:transparent!important;opacity:0!important}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-icon-suffix{align-self:stretch;flex:0 0 auto;min-width:0;display:inline-flex;align-items:center;justify-content:center;padding-right:.14rem}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-container{grid-template-columns:var(--date-input-compact-chip-width) 12px var(--date-input-compact-chip-width);column-gap:.12rem;width:100%;min-height:var(--date-input-compact-shell-height);height:var(--date-input-compact-shell-height);align-items:center;justify-content:center;overflow:hidden}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-start-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-end-wrapper{flex:0 0 var(--date-input-compact-chip-width)!important;width:var(--date-input-compact-chip-width);max-width:var(--date-input-compact-chip-width);min-height:var(--date-input-compact-chip-height);height:var(--date-input-compact-chip-height);justify-content:center;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1px #2a538d29!important}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-end-wrapper{flex-grow:0!important}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-separator{min-height:var(--date-input-compact-shell-height);height:var(--date-input-compact-shell-height);margin:0;color:#5f7899;display:inline-flex;align-items:center;justify-content:center;line-height:var(--date-input-compact-shell-height)}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-inner, [_nghost-%COMP%]     .date-input--range-compact .date-input__material--range input, [_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-mirror{height:var(--date-input-compact-chip-height);min-height:var(--date-input-compact-chip-height);font-size:.76rem;font-weight:700;color:#2c4c74;line-height:var(--date-input-compact-chip-height);text-align:center;align-self:center}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-inner::placeholder{color:#2c4c747a}.date-input__toggle[_ngcontent-%COMP%]{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;min-width:28px;min-height:28px;padding:0;border:0;border-radius:999px;background:transparent;color:#315a86;cursor:pointer;transform-origin:center;transition:background-color .14s ease,color .14s ease,transform .14s ease,box-shadow .14s ease}.date-input__toggle[_ngcontent-%COMP%]:hover{background:#3b68a41a;color:#224a74}.date-input__toggle[_ngcontent-%COMP%]:active{transform:scale(.94)}.date-input__toggle--open[_ngcontent-%COMP%]{background:#315a8624;color:#1f4d7d;box-shadow:inset 0 0 0 1px #315a8624}.date-input__toggle--open[_ngcontent-%COMP%]:hover{background:#315a862e}.date-input--range-compact[_ngcontent-%COMP%]   .date-input__toggle[_ngcontent-%COMP%]{color:#365677;align-self:center}.date-input--range-compact[_ngcontent-%COMP%]   .date-input__toggle[_ngcontent-%COMP%]:hover{background:#3d68a71a;color:#24486e}.date-input__toggle[_ngcontent-%COMP%]:disabled{cursor:default;opacity:.58;transform:none;pointer-events:none}.date-input__toggle[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{width:18px;height:18px;font-size:18px;line-height:18px;transform-origin:center;transition:transform .18s cubic-bezier(.22,.61,.36,1),opacity .14s ease,filter .14s ease}.date-input__toggle--open[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{transform:rotate(90deg)}.date-input__meta[_ngcontent-%COMP%]{display:grid;gap:.34rem;justify-items:start;min-width:0}.date-input__meta-label[_ngcontent-%COMP%]{color:#203a5d;font-size:.84rem;font-weight:700;line-height:1.2}.date-input__meta-badge[_ngcontent-%COMP%]{min-height:38px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;width:fit-content;max-width:100%;padding:0 14px;border:1px solid #b9cce5;border-radius:999px;background:#f3f8ff;color:#27568e;box-shadow:0 8px 18px #29548714;font-size:.88rem;font-weight:900;line-height:1.1;white-space:nowrap}.date-input__meta-icon[_ngcontent-%COMP%]{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-family:"Noto Sans Symbols 2",Noto Sans Symbols,Segoe UI Symbol,sans-serif;font-size:18px;line-height:18px}.date-input__meta-badge--purple[_ngcontent-%COMP%]{border-color:#c8b7f2;background:#f5efff;color:#6941a6;box-shadow:0 8px 18px #6941a61a}.date-input__meta-badge--blue[_ngcontent-%COMP%]{border-color:#b9cce5;background:#f3f8ff;color:#27568e;box-shadow:0 8px 18px #29548714}.date-input__meta-badge--green[_ngcontent-%COMP%]{border-color:#a8dcb8;background:#f0fbf3;color:#2f7b47;box-shadow:0 8px 18px #2f7b471a}.date-input__meta-badge--violet[_ngcontent-%COMP%]{border-color:#c9b7e8;background:#f7f1ff;color:#65409b;box-shadow:0 8px 18px #65409b1a}.date-input__meta-badge--pink[_ngcontent-%COMP%]{border-color:#efb7d3;background:#fff0f7;color:#9a3f70;box-shadow:0 8px 18px #9a3f701a}.date-input__meta-badge--orange[_ngcontent-%COMP%]{border-color:#efc19d;background:#fff5ec;color:#93551e;box-shadow:0 8px 18px #93551e1a}.date-input__meta-badge--brown[_ngcontent-%COMP%]{border-color:#d7bd9c;background:#fbf4ec;color:#77502b;box-shadow:0 8px 18px #77502b1a}.date-input__meta-badge--teal[_ngcontent-%COMP%]{border-color:#a8d7d5;background:#effafa;color:#286f72;box-shadow:0 8px 18px #286f721a}.date-input__meta-badge--muted[_ngcontent-%COMP%]{border-color:#c7d0dc;background:#f5f7fa;color:#536274;box-shadow:0 8px 18px #53627414}.date-input__meta-badge--aries[_ngcontent-%COMP%]{border-color:#efb2a5;background:#fff1ed;color:#9b3f2c;box-shadow:0 8px 18px #9b3f2c1a}.date-input__meta-badge--taurus[_ngcontent-%COMP%]{border-color:#a7d69f;background:#f0faee;color:#3d7a31;box-shadow:0 8px 18px #3d7a311a}.date-input__meta-badge--gemini[_ngcontent-%COMP%]{border-color:#e6ce77;background:#fff9dc;color:#806219;box-shadow:0 8px 18px #8062191a}.date-input__meta-badge--cancer[_ngcontent-%COMP%]{border-color:#9fd8e6;background:#effbff;color:#237083;box-shadow:0 8px 18px #2370831a}.date-input__meta-badge--leo[_ngcontent-%COMP%]{border-color:#efc061;background:#fff5d9;color:#975d12;box-shadow:0 8px 18px #975d121a}.date-input__meta-badge--virgo[_ngcontent-%COMP%]{border-color:#bfd28d;background:#f8fbe9;color:#62752b;box-shadow:0 8px 18px #62752b1a}.date-input__meta-badge--libra[_ngcontent-%COMP%]{border-color:#efb7d3;background:#fff0f7;color:#9a3f70;box-shadow:0 8px 18px #9a3f701a}.date-input__meta-badge--scorpio[_ngcontent-%COMP%]{border-color:#c0a3d9;background:#f7effc;color:#663285;box-shadow:0 8px 18px #6632851a}.date-input__meta-badge--sagittarius[_ngcontent-%COMP%]{border-color:#b9a8ee;background:#f4f0ff;color:#553ca0;box-shadow:0 8px 18px #553ca01a}.date-input__meta-badge--capricorn[_ngcontent-%COMP%]{border-color:#cdb497;background:#fbf2e9;color:#705032;box-shadow:0 8px 18px #7050321a}.date-input__meta-badge--aquarius[_ngcontent-%COMP%]{border-color:#a8c8ef;background:#f0f7ff;color:#2c5f9f;box-shadow:0 8px 18px #2c5f9f1a}.date-input__meta-badge--pisces[_ngcontent-%COMP%]{border-color:#9cd5cf;background:#effaf8;color:#277268;box-shadow:0 8px 18px #2772681a}[_nghost-%COMP%]     .date-input__material.mat-mdc-form-field-disabled .mat-mdc-text-field-wrapper{background:linear-gradient(180deg,#f3f6fa,#e8edf5)!important;border-color:#7a8ca86b;box-shadow:none;cursor:not-allowed}[_nghost-%COMP%]     .date-input__material.mat-mdc-form-field-disabled .mat-mdc-input-element, [_nghost-%COMP%]     .date-input__material.mat-mdc-form-field-disabled .mat-icon{color:#3a4c67b3!important;-webkit-text-fill-color:rgba(58,76,103,.7)}@media(max-width:760px){.date-input--range[_ngcontent-%COMP%]{grid-template-columns:1fr}.date-input--single.date-input--with-meta[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) max-content;column-gap:.5rem}.date-input--with-time[_ngcontent-%COMP%]   .date-input__row[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) minmax(108px,122px)}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-container{grid-template-columns:10ch 12px 10ch;column-gap:.08rem}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-inner, [_nghost-%COMP%]     .date-input--range-compact .date-input__material--range input{font-size:.74rem}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-icon-suffix{padding-right:.06rem}}@media(max-width:520px){.date-input--single.date-input--with-meta[_ngcontent-%COMP%]{column-gap:.42rem}.date-input__meta-badge[_ngcontent-%COMP%]{min-height:36px;padding:0 10px;gap:6px;font-size:.84rem}.date-input__meta-icon[_ngcontent-%COMP%]{width:16px;height:16px;font-size:16px;line-height:16px}.date-input--with-time[_ngcontent-%COMP%]   .date-input__row[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) minmax(86px,104px);gap:.42rem}}'],changeDetection:0})};var Rs=["*"],Vs=(i,a)=>[i,a],Fs=(i,a,e,t)=>[i,a,e,t],Dt=()=>[],On=(i,a)=>a.id;function Ls(i,a){if(i&1&&(c(0,"mat-icon"),_(1),p()),i&2){let e=d(3);l(),k(e.popupModel.headerLabelIcon)}}function Bs(i,a){if(i&1&&(c(0,"span",8),v(1,Ls,2,1,"mat-icon"),c(2,"span"),_(3),Pe(4,"i18n"),p()()),i&2){let e=d(2);w("data-i18n-ignore",e.popupModel.translateHeaderLabel===!1?"":null),l(),y(e.popupModel.headerLabelIcon?1:-1),l(2),k(e.popupModel.translateHeaderLabel===!1?e.popupModel.headerLabel:Te(4,3,e.popupModel.headerLabel))}}function zs(i,a){if(i&1&&(c(0,"h2"),_(1),Pe(2,"i18n"),p()),i&2){let e=d(2);w("data-i18n-ignore",e.popupModel.translateTitle===!1?"":null),l(),Se(" ",e.popupModel.translateTitle===!1?e.popupModel.title:Te(2,2,e.popupModel.title)," ")}}function Ns(i,a){if(i&1&&(c(0,"p",9),_(1),Pe(2,"i18n"),p()),i&2){let e=d(2);w("data-i18n-ignore",e.popupModel.translateSubtitle===!1?"":null),l(),Se(" ",e.popupModel.translateSubtitle===!1?e.popupModel.subtitle:Te(2,2,e.popupModel.subtitle)," ")}}function Hs(i,a){if(i&1&&(c(0,"p",10),_(1),Pe(2,"i18n"),p()),i&2){let e=d(2);w("data-i18n-ignore",e.popupModel.translateSecondarySubtitle===!1?"":null),l(),Se(" ",e.popupModel.translateSecondarySubtitle===!1?e.popupModel.secondarySubtitle:Te(2,2,e.popupModel.secondarySubtitle)," ")}}function Ys(i,a){if(i&1){let e=R();c(0,"app-menu",18),f("itemSelect",function(n){u(e);let o=d().$implicit,r=d(3);return h(r.selectMenuItem(o,n))}),p()}if(i&2){let e=d().$implicit;b("kind",e.menuKind??"select")("title",e.title??null)("trigger",e.trigger??null)("items",e.items??nt(10,Dt))("groups",e.groups??nt(11,Dt))("model",e.model??null)("panelAlign",e.panelAlign??"auto")("panelMode",e.panelMode??"auto")("mobileBreakpointPx",e.mobileBreakpointPx??760)("closeOnSelect",e.closeOnSelect??!0)}}function js(i,a){if(i&1){let e=R();c(0,"app-date-input",19),f("ngModelChange",function(n){u(e);let o=d().$implicit,r=d(3);return h(r.changeDateInput(o,n))}),p()}if(i&2){let e=d().$implicit;b("model",e.model)("ngModel",e.value)}}function Ws(i,a){if(i&1&&(c(0,"span"),_(1),Pe(2,"i18n"),p()),i&2){let e=d(2).$implicit;l(),k(Te(2,1,e.label))}}function qs(i,a){if(i&1&&(c(0,"span",21),_(1),p()),i&2){let e=d(2).$implicit,t=d(3);l(),k(t.actionCounterValue(e))}}function $s(i,a){if(i&1){let e=R();c(0,"button",20),f("click",function(n){u(e);let o=d().$implicit,r=d(3);return h(r.selectAction(o,n))}),c(1,"mat-icon"),_(2),p(),v(3,Ws,3,3,"span"),v(4,qs,2,1,"span",21),p()}if(i&2){let e=d().$implicit,t=d(3);D("ui-popup__action--active",e.active)("ui-popup__action--icon-only",!e.label)("ui-popup__action--compact-mobile",e.compactOnMobile),b("ngClass",t.actionPaletteClass(e))("disabled",e.disabled),w("aria-label",e.ariaLabel||e.label||e.id),l(2),k(e.icon),l(),y(e.label?3:-1),l(),y(t.actionCounterValue(e)?4:-1)}}function Xs(i,a){if(i&1&&v(0,Ys,1,12,"app-menu",16)(1,js,1,2,"app-date-input",17)(2,$s,5,12,"button",14),i&2){let e=a.$implicit,t=d(3);y(t.isMenuControl(e)?0:t.isDateInputControl(e)?1:2)}}function Us(i,a){if(i&1&&(c(0,"div",11),ke(1,Xs,3,1,null,null,On),p()),i&2){let e=d(2);l(),Me(e.headerControls)}}function Ks(i,a){if(i&1&&(c(0,"span",13),_(1),Pe(2,"i18n"),p()),i&2){let e=d(2);w("data-i18n-ignore",e.popupModel.translateHeaderBadge===!1?"":null),l(),Se(" ",e.popupModel.translateHeaderBadge===!1?e.popupModel.headerBadge:Te(2,2,e.popupModel.headerBadge)," ")}}function Gs(i,a){if(i&1&&(c(0,"span"),_(1),Pe(2,"i18n"),p()),i&2){let e=d().$implicit;l(),k(Te(2,1,e.label))}}function Zs(i,a){if(i&1&&(c(0,"span",21),_(1),p()),i&2){let e=d().$implicit,t=d(2);l(),k(t.actionCounterValue(e))}}function Qs(i,a){if(i&1){let e=R();c(0,"button",20),f("click",function(n){let o=u(e).$implicit,r=d(2);return h(r.selectAction(o,n))}),c(1,"mat-icon"),_(2),p(),v(3,Gs,3,3,"span"),v(4,Zs,2,1,"span",21),p()}if(i&2){let e=a.$implicit,t=d(2);D("ui-popup__action--active",e.active)("ui-popup__action--icon-only",!e.label)("ui-popup__action--compact-mobile",e.compactOnMobile),b("ngClass",t.actionPaletteClass(e))("disabled",e.disabled),w("aria-label",e.ariaLabel||e.label||e.id),l(2),k(e.icon),l(),y(e.label?3:-1),l(),y(t.actionCounterValue(e)?4:-1)}}function Js(i,a){if(i&1){let e=R();c(0,"button",22),f("click",function(n){u(e);let o=d(2);return h(o.emitClose(n))}),c(1,"mat-icon"),_(2,"close"),p()()}if(i&2){let e=d(2);w("aria-label",e.closeAriaLabel)}}function el(i,a){if(i&1&&(c(0,"header",3)(1,"div",7),v(2,Bs,5,5,"span",8),v(3,zs,3,4,"h2"),v(4,Ns,3,4,"p",9),v(5,Hs,3,4,"p",10),p(),v(6,Us,3,0,"div",11),c(7,"div",12),v(8,Ks,3,4,"span",13),ke(9,Qs,5,12,"button",14,On),v(11,Js,3,1,"button",15),p()()),i&2){let e=d();b("ngClass",Ti(10,Fs,e.headerToneClass(),e.headerLayoutClass(),e.headerPaletteClass(),e.headerTitleToneClass())),l(2),y(e.popupModel.headerLabel?2:-1),l(),y(e.popupModel.title?3:-1),l(),y(e.popupModel.subtitle?4:-1),l(),y(e.popupModel.secondarySubtitle?5:-1),l(),y(e.hasHeaderControls?6:-1),l(),D("ui-popup__header-actions--empty",!e.hasHeaderBadge&&!e.hasHeaderActions&&!e.showClose),l(),y(e.popupModel.headerBadge?8:-1),l(),Me(e.headerActions),l(2),y(e.showClose?11:-1)}}function tl(i,a){if(i&1){let e=R();c(0,"button",23),f("click",function(n){u(e);let o=d();return h(o.emitClose(n))}),c(1,"mat-icon"),_(2,"close"),p()()}if(i&2){let e=d();w("aria-label",e.closeAriaLabel)}}function nl(i,a){if(i&1){let e=R();c(0,"app-menu",18),f("itemSelect",function(n){u(e);let o=d().$implicit,r=d(3);return h(r.selectMenuItem(o,n))}),p()}if(i&2){let e=d().$implicit;b("kind",e.menuKind??"select")("title",e.title??null)("trigger",e.trigger??null)("items",e.items??nt(10,Dt))("groups",e.groups??nt(11,Dt))("model",e.model??null)("panelAlign",e.panelAlign??"auto")("panelMode",e.panelMode??"auto")("mobileBreakpointPx",e.mobileBreakpointPx??760)("closeOnSelect",e.closeOnSelect??!0)}}function il(i,a){if(i&1){let e=R();c(0,"app-date-input",19),f("ngModelChange",function(n){u(e);let o=d().$implicit,r=d(3);return h(r.changeDateInput(o,n))}),p()}if(i&2){let e=d().$implicit;b("model",e.model)("ngModel",e.value)}}function al(i,a){if(i&1&&(c(0,"span"),_(1),Pe(2,"i18n"),p()),i&2){let e=d(2).$implicit;l(),k(Te(2,1,e.label))}}function ol(i,a){if(i&1&&(c(0,"span",21),_(1),p()),i&2){let e=d(2).$implicit,t=d(3);l(),k(t.actionCounterValue(e))}}function rl(i,a){if(i&1){let e=R();c(0,"button",20),f("click",function(n){u(e);let o=d().$implicit,r=d(3);return h(r.selectAction(o,n))}),c(1,"mat-icon"),_(2),p(),v(3,al,3,3,"span"),v(4,ol,2,1,"span",21),p()}if(i&2){let e=d().$implicit,t=d(3);D("ui-popup__action--active",e.active)("ui-popup__action--icon-only",!e.label)("ui-popup__action--compact-mobile",e.compactOnMobile),b("ngClass",t.actionPaletteClass(e))("disabled",e.disabled),w("aria-label",e.ariaLabel||e.label||e.id),l(2),k(e.icon),l(),y(e.label?3:-1),l(),y(t.actionCounterValue(e)?4:-1)}}function sl(i,a){if(i&1&&v(0,nl,1,12,"app-menu",16)(1,il,1,2,"app-date-input",17)(2,rl,5,12,"button",14),i&2){let e=a.$implicit,t=d(3);y(t.isMenuControl(e)?0:t.isDateInputControl(e)?1:2)}}function ll(i,a){if(i&1&&(c(0,"div",25),ke(1,sl,3,1,null,null,On),p()),i&2){let e=d(2);l(),Me(e.toolbarStartControls)}}function dl(i,a){if(i&1){let e=R();c(0,"app-menu",18),f("itemSelect",function(n){u(e);let o=d().$implicit,r=d(3);return h(r.selectMenuItem(o,n))}),p()}if(i&2){let e=d().$implicit;b("kind",e.menuKind??"select")("title",e.title??null)("trigger",e.trigger??null)("items",e.items??nt(10,Dt))("groups",e.groups??nt(11,Dt))("model",e.model??null)("panelAlign",e.panelAlign??"auto")("panelMode",e.panelMode??"auto")("mobileBreakpointPx",e.mobileBreakpointPx??760)("closeOnSelect",e.closeOnSelect??!0)}}function cl(i,a){if(i&1){let e=R();c(0,"app-date-input",19),f("ngModelChange",function(n){u(e);let o=d().$implicit,r=d(3);return h(r.changeDateInput(o,n))}),p()}if(i&2){let e=d().$implicit;b("model",e.model)("ngModel",e.value)}}function pl(i,a){if(i&1&&(c(0,"span"),_(1),Pe(2,"i18n"),p()),i&2){let e=d(2).$implicit;l(),k(Te(2,1,e.label))}}function ml(i,a){if(i&1&&(c(0,"span",21),_(1),p()),i&2){let e=d(2).$implicit,t=d(3);l(),k(t.actionCounterValue(e))}}function ul(i,a){if(i&1){let e=R();c(0,"button",20),f("click",function(n){u(e);let o=d().$implicit,r=d(3);return h(r.selectAction(o,n))}),c(1,"mat-icon"),_(2),p(),v(3,pl,3,3,"span"),v(4,ml,2,1,"span",21),p()}if(i&2){let e=d().$implicit,t=d(3);D("ui-popup__action--active",e.active)("ui-popup__action--icon-only",!e.label)("ui-popup__action--compact-mobile",e.compactOnMobile),b("ngClass",t.actionPaletteClass(e))("disabled",e.disabled),w("aria-label",e.ariaLabel||e.label||e.id),l(2),k(e.icon),l(),y(e.label?3:-1),l(),y(t.actionCounterValue(e)?4:-1)}}function hl(i,a){if(i&1&&v(0,dl,1,12,"app-menu",16)(1,cl,1,2,"app-date-input",17)(2,ul,5,12,"button",14),i&2){let e=a.$implicit,t=d(3);y(t.isMenuControl(e)?0:t.isDateInputControl(e)?1:2)}}function fl(i,a){if(i&1&&(c(0,"div",26),ke(1,hl,3,1,null,null,On),p()),i&2){let e=d(2);l(),Me(e.toolbarEndControls)}}function _l(i,a){if(i&1&&(c(0,"div",24),v(1,ll,3,0,"div",25),v(2,fl,3,0,"div",26),p()),i&2){let e=d();D("ui-popup__toolbar--mobile-start",e.popupModel.toolbarMobileAlign==="start")("ui-popup__toolbar--mobile-center",e.popupModel.toolbarMobileAlign==="center")("ui-popup__toolbar--mobile-end",e.popupModel.toolbarMobileAlign==="end"),l(),y(e.hasToolbarStartControls?1:-1),l(),y(e.hasToolbarEndControls?2:-1)}}var mo=class i{model=null;zIndex=null;close=new M;menuSelect=new M;action=new M;dateInputChange=new M;get popupModel(){return this.model??{}}get ariaLabel(){return this.popupModel.ariaLabel?.trim()||this.popupModel.title?.trim()||"Popup"}get closeAriaLabel(){return this.popupModel.closeAriaLabel?.trim()||"Close"}get closeOnBackdrop(){return this.popupModel.closeOnBackdrop!==!1}get showClose(){return this.popupModel.showClose!==!1}get showHeader(){return this.popupModel.showHeader!==!1}get hasHeader(){return this.showHeader&&(!!this.popupModel.title?.trim()||!!this.popupModel.subtitle?.trim()||!!this.popupModel.secondarySubtitle?.trim()||!!this.popupModel.headerLabel?.trim()||!!this.popupModel.headerBadge?.trim()||this.hasHeaderControls||this.hasHeaderActions||this.showClose)}get headerControls(){return this.popupModel.headerControls??[]}get headerActions(){return this.popupModel.headerActions??[]}get toolbarControls(){return this.popupModel.toolbarControls??[]}get toolbarStartControls(){return this.toolbarControls.filter(a=>a.align!=="end")}get toolbarEndControls(){return this.toolbarControls.filter(a=>a.align==="end")}get hasToolbar(){return this.toolbarControls.length>0}get hasToolbarStartControls(){return this.toolbarStartControls.length>0}get hasToolbarEndControls(){return this.toolbarEndControls.length>0}get hasHeaderControls(){return this.headerControls.length>0}get hasHeaderActions(){return this.headerActions.length>0}get hasHeaderBadge(){return!!this.popupModel.headerBadge?.trim()}onBackdropClick(a){this.closeOnBackdrop&&this.emitClose(a)}onPanelClick(a){a.stopPropagation()}isMenuControl(a){return"kind"in a&&a.kind==="menu"}isDateInputControl(a){return"kind"in a&&a.kind==="date-input"}actionPaletteClass(a){return`ui-popup__action--${a.palette??"default"}`}actionCounterValue(a){let e=a.counter;if(e==null)return"";let t=typeof e=="object"&&"value"in e?e.value:e,o=`${(typeof t=="function"?t():t)??""}`.trim();return o==="0"?"":o}panelSizeClass(){return`ui-popup__panel--${this.popupModel.size??"default"}`}panelHeightClass(){return`ui-popup__panel--height-${this.popupModel.height??"auto"}`}headerToneClass(){return`ui-popup__header--${this.popupModel.headerTone??"default"}`}headerLayoutClass(){return`ui-popup__header--layout-${this.popupModel.headerLayout??"default"}`}headerPaletteClass(){return`ui-popup__header--palette-${this.popupModel.headerPalette??"default"}`}headerTitleToneClass(){return`ui-popup__header--title-${this.popupModel.headerTitleTone??"palette"}`}bodyLayoutClass(){return`ui-popup__body--${this.popupModel.bodyLayout??"default"}`}backdropToneClass(){return`ui-popup__backdrop--${this.popupModel.backdropTone??"default"}`}emitClose(a){this.popupModel.onClose?.(a),this.close.emit(a)}selectMenuItem(a,e){let t={control:a,itemSelect:e};this.popupModel.onMenuSelect?.(t),this.menuSelect.emit(t)}changeDateInput(a,e){let t={control:a,value:e};this.popupModel.onDateInputChange?.(t),this.dateInputChange.emit(t)}selectAction(a,e){if(a.disabled)return;let t={action:a,sourceEvent:e};this.popupModel.onAction?.(t),this.action.emit(t)}static \u0275fac=function(e){return new(e||i)};static \u0275cmp=E({type:i,selectors:[["app-popup"]],inputs:{model:"model",zIndex:"zIndex"},outputs:{close:"close",menuSelect:"menuSelect",action:"action",dateInputChange:"dateInputChange"},ngContentSelectors:Rs,decls:8,vars:18,consts:[[1,"ui-popup"],[1,"ui-popup__backdrop",3,"click","ngClass"],["role","dialog","aria-modal","true",1,"ui-popup__panel",3,"click","ngClass"],[1,"ui-popup__header",3,"ngClass"],["type","button",1,"ui-popup__close","ui-popup__close--floating"],[1,"ui-popup__toolbar",3,"ui-popup__toolbar--mobile-start","ui-popup__toolbar--mobile-center","ui-popup__toolbar--mobile-end"],[1,"ui-popup__body",3,"ngClass"],[1,"ui-popup__title"],[1,"ui-popup__label"],[1,"ui-popup__subtitle"],[1,"ui-popup__subtitle","ui-popup__subtitle--secondary"],[1,"ui-popup__header-controls"],[1,"ui-popup__header-actions"],[1,"ui-popup__badge"],["type","button",1,"ui-popup__action",3,"ngClass","ui-popup__action--active","ui-popup__action--icon-only","ui-popup__action--compact-mobile","disabled"],["type","button",1,"ui-popup__close"],[1,"ui-popup__control",3,"kind","title","trigger","items","groups","model","panelAlign","panelMode","mobileBreakpointPx","closeOnSelect"],[1,"ui-popup__date-input",3,"model","ngModel"],[1,"ui-popup__control",3,"itemSelect","kind","title","trigger","items","groups","model","panelAlign","panelMode","mobileBreakpointPx","closeOnSelect"],[1,"ui-popup__date-input",3,"ngModelChange","model","ngModel"],["type","button",1,"ui-popup__action",3,"click","ngClass","disabled"],[1,"ui-popup__action-counter"],["type","button",1,"ui-popup__close",3,"click"],["type","button",1,"ui-popup__close","ui-popup__close--floating",3,"click"],[1,"ui-popup__toolbar"],[1,"ui-popup__toolbar-group","ui-popup__toolbar-group--start"],[1,"ui-popup__toolbar-group","ui-popup__toolbar-group--end"]],template:function(e,t){e&1&&(ie(),c(0,"div",0)(1,"div",1),f("click",function(o){return t.onBackdropClick(o)}),p(),c(2,"section",2),f("click",function(o){return t.onPanelClick(o)}),v(3,el,12,15,"header",3),v(4,tl,3,1,"button",4),v(5,_l,3,8,"div",5),c(6,"div",6),z(7),p()()()),e&2&&(tt("z-index",t.zIndex??null),D("ui-popup--fullscreen",t.popupModel.size==="fullscreen")("ui-popup--auto-height",t.popupModel.height!=="full"&&t.popupModel.size!=="fullscreen"),l(),b("ngClass",t.backdropToneClass()),l(),D("ui-popup__panel--overflow-visible",t.popupModel.bodyLayout==="overflow"),b("ngClass",Pi(15,Vs,t.panelSizeClass(),t.panelHeightClass())),w("aria-label",t.ariaLabel),l(),y(t.hasHeader?3:-1),l(),y(!t.hasHeader&&t.showClose?4:-1),l(),y(t.hasToolbar?5:-1),l(),b("ngClass",t.bodyLayoutClass()))},dependencies:[Gt,Kt,nn,Qt,en,rn,on,ji,Tn,Yi],styles:[`app-popup{display:contents;--line: rgba(23, 33, 54, .12);--line-strong: rgba(23, 33, 54, .2);--text-main: #22324a;--text-muted: rgba(23, 41, 66, .72)}.ui-popup{position:fixed;inset:0;z-index:2300;display:flex;align-items:flex-start;justify-content:center;padding:1rem}.ui-popup--fullscreen{align-items:stretch;justify-content:stretch;padding:0}@media(min-width:761px){.ui-popup--auto-height{align-items:center}}.ui-popup__backdrop{position:absolute;inset:0;background:#e9edf5}.ui-popup__backdrop--dim{background:#08101e8f;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}.ui-popup__panel{position:relative;z-index:1;width:min(760px,100vw - 1.2rem);max-height:calc(100vh - 1.2rem);max-height:calc(100dvh - 1.2rem);border-radius:14px;background:#fff;box-shadow:0 18px 42px #00000042;overflow:hidden;display:flex;flex-direction:column}.ui-popup__panel--small{width:min(380px,100vw - 1.2rem)}.ui-popup__panel--wide{width:min(1080px,100vw - 1.2rem)}.ui-popup__panel--fullscreen{width:100vw;max-width:100vw;min-width:100vw;height:100vh;height:100dvh;max-height:100vh;max-height:100dvh;min-height:100vh;min-height:100dvh;border-radius:0;background:#111317;box-shadow:none}.ui-popup__panel--height-full{height:calc(100vh - 1.2rem);height:calc(100dvh - 1.2rem);max-height:calc(100vh - 1.2rem);max-height:calc(100dvh - 1.2rem)}.ui-popup__header{display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"title controls actions";align-items:center;gap:.42rem;padding:.58rem .4rem;border-bottom:1px solid var(--line);position:relative;flex:0 0 auto}.ui-popup__header--accent{border-bottom-color:#2e72b833}.ui-popup__header--layout-article{align-items:flex-start;gap:.72rem;padding:clamp(.84rem,2vw,1.35rem) clamp(.84rem,2vw,1.35rem) 0;border-bottom:0}.ui-popup__header--layout-document{--ui-popup-document-header-bg: linear-gradient(180deg, #eef3f8 0%, #f8fafc 100%);--ui-popup-document-header-border: rgba(72, 92, 118, .24);--ui-popup-document-header-title: #304157;--ui-popup-document-header-text: rgba(48, 65, 87, .78);--ui-popup-document-header-badge-bg: #40566f;align-items:flex-start;gap:.62rem;padding:.9rem .72rem .82rem;border-bottom-color:var(--ui-popup-document-header-border);background:var(--ui-popup-document-header-bg)}.ui-popup__header--palette-amber{--ui-popup-document-header-bg: linear-gradient(180deg, #fbf4e8 0%, #fffaf0 100%);--ui-popup-document-header-border: rgba(157, 118, 41, .24);--ui-popup-document-header-title: #7c5618;--ui-popup-document-header-text: rgba(108, 74, 19, .84);--ui-popup-document-header-badge-bg: #b66a15}.ui-popup__header--palette-blue{--ui-popup-document-header-bg: linear-gradient(180deg, #eef6ff 0%, #f8fbff 100%);--ui-popup-document-header-border: rgba(53, 96, 162, .24);--ui-popup-document-header-title: #1f3f6f;--ui-popup-document-header-text: rgba(46, 78, 119, .84);--ui-popup-document-header-badge-bg: #2f6fae}.ui-popup__header--palette-green{--ui-popup-document-header-bg: linear-gradient(180deg, #f0fbf3 0%, #e4f7ea 100%);--ui-popup-document-header-border: rgba(58, 143, 91, .3);--ui-popup-document-header-title: #246b42;--ui-popup-document-header-text: rgba(35, 94, 58, .84);--ui-popup-document-header-badge-bg: #1f7a49}.ui-popup__header--palette-teal{--ui-popup-document-header-bg: linear-gradient(180deg, #eefafa 0%, #f7fdfd 100%);--ui-popup-document-header-border: rgba(33, 126, 132, .24);--ui-popup-document-header-title: #17646d;--ui-popup-document-header-text: rgba(28, 91, 99, .84);--ui-popup-document-header-badge-bg: #197987}.ui-popup__header--palette-rose{--ui-popup-document-header-bg: linear-gradient(180deg, #fff1f4 0%, #fff8fa 100%);--ui-popup-document-header-border: rgba(178, 69, 98, .26);--ui-popup-document-header-title: #8c2e49;--ui-popup-document-header-text: rgba(122, 45, 70, .84);--ui-popup-document-header-badge-bg: #b94462}.ui-popup__header--palette-violet{--ui-popup-document-header-bg: linear-gradient(180deg, #f5f0ff 0%, #fbf8ff 100%);--ui-popup-document-header-border: rgba(107, 80, 175, .26);--ui-popup-document-header-title: #50398e;--ui-popup-document-header-text: rgba(75, 52, 128, .84);--ui-popup-document-header-badge-bg: #6b50af}.ui-popup__header--palette-slate{--ui-popup-document-header-bg: linear-gradient(180deg, #eef3f8 0%, #f8fafc 100%);--ui-popup-document-header-border: rgba(72, 92, 118, .24);--ui-popup-document-header-title: #304157;--ui-popup-document-header-text: rgba(48, 65, 87, .78);--ui-popup-document-header-badge-bg: #40566f}.ui-popup__header--title-neutral{--ui-popup-document-header-title: #172234;--ui-popup-document-header-text: #172234}.ui-popup__title{grid-area:title;min-width:0}.ui-popup__label{display:inline-flex;align-items:center;gap:.26rem;color:#274265c2;font-size:.74rem;font-weight:800}.ui-popup__label .mat-icon{width:14px;height:14px;font-size:14px;line-height:14px}.ui-popup__header--layout-document .ui-popup__label{color:var(--ui-popup-document-header-text);font-size:.78rem;font-weight:900}.ui-popup__title h2{margin:0;font-size:1.05rem;color:var(--text-main);font-weight:700;letter-spacing:0}.ui-popup__header--layout-article .ui-popup__title h2{margin:.22rem 0 0;max-width:820px;color:#173456;font-size:clamp(1.46rem,3vw,2.36rem);line-height:1.08;font-weight:950}.ui-popup__header--layout-document .ui-popup__title h2{color:var(--ui-popup-document-header-title);font-size:clamp(1.22rem,2.4vw,1.52rem);line-height:1.12;font-weight:950}.ui-popup__subtitle{margin:.14rem 0 0;font-size:.74rem;font-weight:700;color:#15273eb8}.ui-popup__header--layout-article .ui-popup__subtitle{max-width:72ch;margin:.54rem 0 0;color:#1f3658c2;font-size:.94rem;font-weight:800;line-height:1.42}.ui-popup__header--layout-document .ui-popup__subtitle{margin-top:.34rem;color:var(--ui-popup-document-header-text);font-size:.88rem;font-weight:400;line-height:1.45}.ui-popup__subtitle--secondary{margin-top:.04rem;font-size:.68rem;font-weight:800;letter-spacing:.01em;color:#15273e94}.ui-popup__header-controls{grid-area:controls;min-width:0;display:inline-flex;align-items:center;justify-content:flex-end;gap:.34rem}.ui-popup__header-controls:empty{display:none}.ui-popup__header-actions{grid-area:actions;display:inline-flex;align-items:center;justify-content:flex-end;gap:.34rem}.ui-popup__header--layout-document .ui-popup__header-actions{align-items:flex-start}.ui-popup__header-actions--empty{display:none}.ui-popup__badge{display:inline-flex;align-items:center;justify-content:center;min-width:0;min-height:1.86rem;border-radius:999px;background:#e8eef6;color:#28476d;padding:0 .72rem;font-size:.74rem;font-weight:900;line-height:1;white-space:nowrap}.ui-popup__header--layout-document .ui-popup__badge{min-height:1.88rem;background:var(--ui-popup-document-header-badge-bg);color:#fff;font-size:.78rem;box-shadow:none}.ui-popup__toolbar{flex:0 0 auto;padding:.4rem .4rem 0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:.36rem .5rem}.ui-popup__toolbar-group{min-width:0;display:flex;align-items:center;gap:.5rem}.ui-popup__toolbar-group--start{grid-column:1;justify-content:flex-start;flex-wrap:wrap}.ui-popup__toolbar-group--end{grid-column:2;justify-content:flex-end;flex-wrap:nowrap;white-space:nowrap}.ui-popup__toolbar-group--end .ui-popup__action,.ui-popup__toolbar-group--end .ui-popup__control,.ui-popup__toolbar-group--end .ui-popup__date-input{flex:0 0 auto}.ui-popup__date-input{flex:0 0 auto;min-width:0}.ui-popup__body{padding:.4rem;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:.72rem;flex:1 1 auto;min-height:0}.ui-popup__body--fill{overflow:hidden}.ui-popup__body--flush{padding:0;gap:0;overflow:hidden}@media(min-width:761px){.ui-popup__panel--overflow-visible,.ui-popup__body--overflow{overflow:visible}}.ui-popup__action{position:relative;min-width:2.25rem;min-height:2.25rem;height:2.25rem;border:1px solid rgba(30,88,152,.46);border-radius:999px;background:linear-gradient(180deg,#e2f0ff,#c5dbf8);color:#15457c;display:inline-flex;align-items:center;justify-content:center;gap:.34rem;cursor:pointer;box-shadow:0 2px 8px #1f4f842e;padding:0 .58rem;font:inherit;font-size:.78rem;font-weight:800;line-height:1;white-space:nowrap}.ui-popup__action-counter{position:absolute;top:-.28rem;right:-.28rem;min-width:1rem;height:1rem;padding:0 .24rem;border-radius:999px;border:1px solid rgba(255,255,255,.86);color:#fff;background:#d63838;box-shadow:0 2px 6px #62202038;display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;font-size:.62rem;line-height:1;font-weight:900;pointer-events:none}.ui-popup__action--icon-only{width:2.25rem;padding:0;border-radius:50%}.ui-popup__action .mat-icon{width:1.14rem;height:1.14rem;font-size:1.14rem;line-height:1.14rem;pointer-events:none}.ui-popup__action:hover{background:linear-gradient(180deg,#d4e8ff,#b5d1f3);border-color:#1b4a8299;color:#103966;box-shadow:0 4px 10px #1c45723d}.ui-popup__action:active:not(:disabled){box-shadow:0 1px 4px #244a7933}.ui-popup__action:disabled{opacity:.54;cursor:not-allowed;box-shadow:0 2px 8px #1f4f841f}.ui-popup__action--neutral,.ui-popup__action--muted{border-color:#5a6c8247;background:linear-gradient(180deg,#f8fafc,#edf1f6);color:#4c617a;box-shadow:0 2px 7px #374b651f}.ui-popup__action--neutral:hover,.ui-popup__action--muted:hover{border-color:#4e627c66;background:linear-gradient(180deg,#fff,#e7edf4);color:#3f5570;box-shadow:0 4px 10px #374b6529}.ui-popup__action--gold,.ui-popup__action--amber{border-color:#bc8a1880;background:linear-gradient(180deg,#fff7df,#ffefc6);color:#8d5d10;box-shadow:0 5px 13px #b47f1733}.ui-popup__action--gold:hover,.ui-popup__action--amber:hover{border-color:#bc8a189e;background:linear-gradient(180deg,#fff2c9,#ffe3a3);color:#7d4f0a;box-shadow:0 4px 10px #b47f1738}.ui-popup__action--blue,.ui-popup__action--sky{border-color:#30558a57;background:linear-gradient(180deg,#f7fbff,#edf4ff);color:#2c5f9b}.ui-popup__action--green,.ui-popup__action--success{border-color:#2f8e5f61;background:linear-gradient(180deg,#effbf4,#dbf2e5);color:#23734a}.ui-popup__action--violet,.ui-popup__action--purple{border-color:#664fae80;background:linear-gradient(180deg,#f0ecff,#e3dbff);color:#5a43a9}.ui-popup__action--rose,.ui-popup__action--pink{border-color:#b758686b;background:linear-gradient(180deg,#fff4f5,#ffe8eb);color:#9b3345;box-shadow:0 2px 7px #8633441f}.ui-popup__action--rose:hover,.ui-popup__action--pink:hover{border-color:#a72d4285;background:linear-gradient(180deg,#ffecef,#fbd8de);color:#8b1f32;box-shadow:0 4px 10px #8633442e}.ui-popup__action--danger,.ui-popup__action--red{border-color:#931f1fa3;background:linear-gradient(180deg,#ffe8e8,#ffcfcf);color:#9a2626}.ui-popup__action--active{border-color:#1a447cad;background:linear-gradient(180deg,#d3e4ff,#bfd7ff);color:#123d73}.ui-popup__action--rose.ui-popup__action--active,.ui-popup__action--pink.ui-popup__action--active{border-color:#a72d428f;background:linear-gradient(180deg,#f7dde1,#f2c8ce);color:#8b1f32;box-shadow:0 4px 12px #ba415633}.ui-popup__close{flex:0 0 auto;width:34px;height:34px;min-width:34px;min-height:34px;border:1px solid rgba(47,86,139,.2);border-radius:50%;background:#ffffffeb;color:#264369eb;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;line-height:0;box-sizing:border-box;box-shadow:0 8px 18px #253e5f1f;--mdc-icon-button-state-layer-size: 34px}.ui-popup__close .mat-icon{display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;font-size:21px;line-height:21px;margin:0}.ui-popup__close:not(:disabled):not([aria-disabled=true]):hover{border-color:#2f568b52;background:#fff;color:#183254fa}.ui-popup__close:not(:disabled):not([aria-disabled=true]):active{background:#eff5fcf5}.ui-popup__close:focus-visible{outline:2px solid rgba(61,108,186,.35);outline-offset:1px}.ui-popup__close--floating{position:absolute;top:1rem;right:1rem;z-index:20}.ui-popup__close:disabled,.ui-popup__close[aria-disabled=true]{opacity:.56;cursor:default}@media(max-width:760px){.ui-popup{padding:0;align-items:stretch}.ui-popup__panel{width:100vw!important;max-width:100vw!important;height:100vh!important;height:100dvh!important;max-height:100vh!important;max-height:100dvh!important;min-height:100dvh;margin:0!important;border-radius:0;box-shadow:none}.ui-popup__body--overflow{overflow-y:auto;overflow-x:hidden}.ui-popup__header{align-items:start;gap:.36rem .44rem;padding:.52rem .48rem .44rem}.ui-popup__header--layout-article{padding:.78rem .78rem 0}.ui-popup__header--layout-document{padding:.72rem .64rem}.ui-popup__header--layout-article .ui-popup__title h2{font-size:clamp(1.28rem,8vw,1.8rem)}.ui-popup__header--layout-document .ui-popup__title h2{font-size:clamp(1.18rem,5.4vw,1.42rem)}.ui-popup__header-controls{width:auto;min-width:0;flex-wrap:nowrap}.ui-popup__header-controls app-menu{max-width:100%}.ui-popup__toolbar{padding:.36rem .48rem 0;display:flex;align-items:center;flex-wrap:nowrap;gap:.24rem;overflow:visible}.ui-popup__toolbar-group{gap:.24rem;flex-wrap:nowrap}.ui-popup__toolbar-group--start{flex:1 1 auto;min-width:0}.ui-popup__toolbar-group--start .ui-popup__control{flex:0 1 auto;min-width:0}.ui-popup__toolbar-group--start app-menu.ui-popup__control.app-menu-host--inline-row-labelled-action{flex:1 1 auto;width:100%;min-width:0}.ui-popup__toolbar-group--end{flex:0 0 auto;gap:.24rem;margin-left:auto}.ui-popup__toolbar-group--end:has(app-menu.ui-popup__control.app-menu-host--inline-row-labelled-action){flex:1 1 auto;width:100%;min-width:0;margin-left:0}.ui-popup__toolbar-group--end app-menu.ui-popup__control.app-menu-host--inline-row-labelled-action{flex:1 1 auto;width:100%;min-width:0}.ui-popup__toolbar--mobile-start .ui-popup__toolbar-group--end,.ui-popup__toolbar--mobile-center .ui-popup__toolbar-group--end,.ui-popup__toolbar--mobile-end .ui-popup__toolbar-group--end{margin-left:0}.ui-popup__toolbar--mobile-start{justify-content:flex-start}.ui-popup__toolbar--mobile-center{justify-content:center}.ui-popup__toolbar--mobile-center .ui-popup__toolbar-group{flex:1 1 auto;width:100%;min-width:0;justify-content:center}.ui-popup__toolbar--mobile-center .ui-popup__toolbar-group app-menu.ui-popup__control.app-menu-host--kind-select{flex:1 1 auto;width:auto;min-width:0}.ui-popup__toolbar--mobile-end{justify-content:flex-end}.ui-popup__toolbar .app-menu__trigger{gap:.22rem;min-width:0;padding-inline:.42rem;font-size:.74rem}.ui-popup__toolbar .app-menu__trigger-label{text-overflow:clip}.ui-popup__toolbar .app-menu__trigger .mat-icon,.ui-popup__toolbar .app-menu__trigger-caret{width:1rem;height:1rem;font-size:1rem;line-height:1rem}.ui-popup__action--compact-mobile{width:2.25rem;padding:0;border-radius:50%}.ui-popup__action--compact-mobile span{display:none}}
`],encapsulation:2,changeDetection:0})};export{ht as a,ft as b,ot as c,Ne as d,ii as e,ti as f,tr as g,ai as h,qn as i,aa as j,Kn as k,Tt as l,$e as m,un as n,Wr as o,_i as p,Ja as q,eo as r,to as s,no as t,Ft as u,ro as v,Tn as w,mo as x};
