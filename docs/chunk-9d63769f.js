import {o as Be,cP as ht,cW as j,R as Ft,e as $r,bw as Yt,ed as ti,bO as b$1,aO as Q$1,ef as tt,bQ as b$2,cp as f$1,cQ as i,bl as Wi,Z as Gi,eP as xi,cd as dC,eY as yC,aD as On,Y as Ge,dc as lf,eV as y,ew as v,dj as m,e9 as si,dF as p,eh as u,eZ as ye$2,bY as c,bb as Ue,dr as mr,cO as hr,at as Mt$1,c6 as cr,eq as ur,aJ as Pn,aC as On$1}from'./chunk-a252562f.js';import {bj as ch,c6 as oa,O as ID,bo as dh,cI as xT,as as Rh,aw as ST,a4 as Nl,cK as xl,cQ as zh,N as I,aY as Zr,X as Me$2,W as MI,bc as bD,K as HF,a3 as Nh,ce as qT,C as C$1,B as BF,an as Qe,_ as Mt,cl as s,cg as r$1,bQ as jy,J as Gt,be as bn,au as Rn,cw as uT,bn as dT,cc as ph,a6 as Nw,a_ as _T,cE as wE,cR as zi,a$ as _l,bU as kh,ah as PT,cJ as xh,ck as rw,bu as eg,ax as Sh,D as DT,w as Fh,bY as ld,cx as ud,c1 as mw,cs as tE,bD as hT,ca as pT,bz as gT,i as At,z as Ga,cn as sE,bg as bw,a0 as Mw,cN as yw,b9 as ar,l as Bh,d as AT,bS as kT,ch as rE,bA as ge$2,bM as jF,e as Al,c2 as nE,bI as ig,c7 as og,bm as cw}from'./main-1f80e530.js';var S=["*"],N=new C$1("MAT_BUTTON_CONFIG");function R$2(n){return n==null?void 0:BF(n)}var b=(()=>{class n{_elementRef=I(Zr);_ngZone=I(Me$2);_animationsDisabled=j();_config=I(N,{optional:true});_focusMonitor=I(Ft);_cleanupClick;_renderer=I(MI);_rippleLoader=I($r);_isAnchor;_isFab=false;color;get disableRipple(){return this._disableRipple}set disableRipple(t){this._disableRipple=t,this._updateRippleDisabled();}_disableRipple=false;get disabled(){return this._disabled}set disabled(t){this._disabled=t,this._updateRippleDisabled();}_disabled=false;ariaDisabled;disabledInteractive;tabIndex;set _tabindex(t){this.tabIndex=t;}constructor(){I(Yt).load(ti);let t=this._elementRef.nativeElement;this._isAnchor=t.tagName==="A",this.disabledInteractive=this._config?.disabledInteractive??false,this.color=this._config?.color??null,this._rippleLoader?.configureRipple(t,{className:"mat-mdc-button-ripple"});}ngAfterViewInit(){this._focusMonitor.monitor(this._elementRef,true),this._isAnchor&&this._setupAsAnchor();}ngOnDestroy(){this._cleanupClick?.(),this._focusMonitor.stopMonitoring(this._elementRef),this._rippleLoader?.destroyRipple(this._elementRef.nativeElement);}focus(t="program",a){t?this._focusMonitor.focusVia(this._elementRef.nativeElement,t,a):this._elementRef.nativeElement.focus(a);}_getAriaDisabled(){return this.ariaDisabled!=null?this.ariaDisabled:this._isAnchor?this.disabled||null:this.disabled&&this.disabledInteractive?true:null}_getDisabledAttribute(){return this.disabledInteractive||!this.disabled?null:true}_updateRippleDisabled(){this._rippleLoader?.setDisabled(this._elementRef.nativeElement,this.disableRipple||this.disabled);}_getTabIndex(){return this._isAnchor?this.disabled&&!this.disabledInteractive?-1:this.tabIndex:this.tabIndex}_setupAsAnchor(){this._cleanupClick=this._ngZone.runOutsideAngular(()=>this._renderer.listen(this._elementRef.nativeElement,"click",t=>{this.disabled&&(t.preventDefault(),t.stopImmediatePropagation());}));}static \u0275fac=function(a){return new(a||n)};static \u0275dir=bD({type:n,hostAttrs:[1,"mat-mdc-button-base"],hostVars:13,hostBindings:function(a,e){a&2&&(Nh("disabled",e._getDisabledAttribute())("aria-disabled",e._getAriaDisabled())("tabindex",e._getTabIndex()),qT(e.color?"mat-"+e.color:""),zh("mat-mdc-button-disabled",e.disabled)("mat-mdc-button-disabled-interactive",e.disabledInteractive)("mat-unthemed",!e.color)("_mat-animation-noopable",e._animationsDisabled));},inputs:{color:"color",disableRipple:[2,"disableRipple","disableRipple",HF],disabled:[2,"disabled","disabled",HF],ariaDisabled:[2,"aria-disabled","ariaDisabled",HF],disabledInteractive:[2,"disabledInteractive","disabledInteractive",HF],tabIndex:[2,"tabIndex","tabIndex",R$2],_tabindex:[2,"tabindex","_tabindex",R$2]}})}return n})(),L$1=(()=>{class n extends b{constructor(){super(),this._rippleLoader.configureRipple(this._elementRef.nativeElement,{centered:true});}static \u0275fac=function(a){return new(a||n)};static \u0275cmp=ID({type:n,selectors:[["button","mat-icon-button",""],["a","mat-icon-button",""],["button","matIconButton",""],["a","matIconButton",""]],hostAttrs:[1,"mdc-icon-button","mat-mdc-icon-button"],exportAs:["matButton","matAnchor"],features:[dh],ngContentSelectors:S,decls:4,vars:0,consts:[[1,"mat-mdc-button-persistent-ripple","mdc-icon-button__ripple"],[1,"mat-focus-indicator"],[1,"mat-mdc-button-touch-target"]],template:function(a,e){a&1&&(xT(),Rh(0,"span",0),ST(1),Rh(2,"span",1)(3,"span",2));},styles:[`.mat-mdc-icon-button {
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
`],encapsulation:2,changeDetection:0})}return n})();var V=[[["",8,"material-icons",3,"iconPositionEnd",""],["mat-icon",3,"iconPositionEnd",""],["","matButtonIcon","",3,"iconPositionEnd",""]],"*",[["","iconPositionEnd","",8,"material-icons"],["mat-icon","iconPositionEnd",""],["","matButtonIcon","","iconPositionEnd",""]]],U$1=[".material-icons:not([iconPositionEnd]), mat-icon:not([iconPositionEnd]), [matButtonIcon]:not([iconPositionEnd])","*",".material-icons[iconPositionEnd], mat-icon[iconPositionEnd], [matButtonIcon][iconPositionEnd]"];var C=new Map([["text",["mat-mdc-button"]],["filled",["mdc-button--unelevated","mat-mdc-unelevated-button"]],["elevated",["mdc-button--raised","mat-mdc-raised-button"]],["outlined",["mdc-button--outlined","mat-mdc-outlined-button"]],["tonal",["mat-tonal-button"]]]),rt=(()=>{class n extends b{get appearance(){return this._appearance}set appearance(t){this.setAppearance(t||this._config?.defaultAppearance||"text");}_appearance=null;constructor(){super();let t=Y$1(this._elementRef.nativeElement);t&&this.setAppearance(t);}setAppearance(t){if(t===this._appearance)return;let a=this._elementRef.nativeElement.classList,e=this._appearance?C.get(this._appearance):null,j=C.get(t);e&&a.remove(...e),a.add(...j),this._appearance=t;}static \u0275fac=function(a){return new(a||n)};static \u0275cmp=ID({type:n,selectors:[["button","matButton",""],["a","matButton",""],["button","mat-button",""],["button","mat-raised-button",""],["button","mat-flat-button",""],["button","mat-stroked-button",""],["a","mat-button",""],["a","mat-raised-button",""],["a","mat-flat-button",""],["a","mat-stroked-button",""]],hostAttrs:[1,"mdc-button"],inputs:{appearance:[0,"matButton","appearance"]},exportAs:["matButton","matAnchor"],features:[dh],ngContentSelectors:U$1,decls:7,vars:4,consts:[[1,"mat-mdc-button-persistent-ripple"],[1,"mdc-button__label"],[1,"mat-focus-indicator"],[1,"mat-mdc-button-touch-target"]],template:function(a,e){a&1&&(xT(V),Rh(0,"span",0),ST(1),Nl(2,"span",1),ST(3,1),xl(),ST(4,2),Rh(5,"span",2)(6,"span",3)),a&2&&zh("mdc-button__ripple",!e._isFab)("mdc-fab__ripple",e._isFab);},styles:[`.mat-mdc-button-base {
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
`],encapsulation:2,changeDetection:0})}return n})();function Y$1(n){return n.hasAttribute("mat-raised-button")?"elevated":n.hasAttribute("mat-stroked-button")?"outlined":n.hasAttribute("mat-flat-button")?"filled":n.hasAttribute("mat-button")?"text":null}var it=(()=>{class n{static \u0275fac=function(a){return new(a||n)};static \u0275mod=ch({type:n});static \u0275inj=oa({imports:[Be,ht]})}return n})();var re$1=/{{([^{}]+)}}/g;function ie$2(n,e,t){let i=ae$1(e);return `${n??""}`.replace(re$1,(r,d)=>{switch(d.trim()){case "deployment.privacy.contactDetails":return i?ce$1(i,t):`<p>${f(t.contactNotPublished)}</p>`;case "deployment.privacy.deletionEmailRoute":return i?le$1(i,t):"";default:return ""}})}function ae$1(n){let e=`${n?.dataControllerName??""}`.trim(),t=`${n?.privacyContactEmail??""}`.trim().toLowerCase();return n?.configured!==true||!e||!f$1.isEmail(t)?null:{configured:true,dataControllerName:e,privacyContactEmail:t}}function ce$1(n,e){let t=f(n.privacyContactEmail);return ["<ul>","<li>",`<strong>${f(e.dataControllerLabel)}:</strong> `,f(n.dataControllerName),"</li>","<li>",`<strong>${f(e.privacyContactEmailLabel)}:</strong> `,`<a href="mailto:${t}">${t}</a>`,"</li>","</ul>"].join("")}function le$1(n,e){let t=f(n.privacyContactEmail);return ["<p>",f(e.deletionEmailPrefix)," ",`<a href="mailto:${t}">${t}</a>`,f(e.deletionEmailSuffix),"</p>"].join("")}function f(n){return `${n??""}`.replace(/[&<>"']/g,e=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[e]??"")}var de$1=()=>({actionSizing:"content"});function me$1(n,e){if(n&1&&(zi(0,"article",5),Sh(1,"app-indicator",8),zi(2,"span"),rw(3),_l()()),n&2){let t=_T(3);wE(3),eg(t.loadingLabel());}}function se$1(n,e){if(n&1&&(zi(0,"p",11),rw(1),_l()),n&2){let t=_T();wE(),eg(t.blurb);}}function ue$1(n,e){if(n&1&&Sh(0,"div",12),n&2){let t=_T();xh("appLazyHtmlImages",true)("innerHTML",t.contentHtml,tE);}}function pe$1(n,e){if(n&1&&(zi(0,"li",14),rw(1),_l()),n&2){let t=e.$implicit;wE(),eg(t);}}function ge$1(n,e){if(n&1&&(zi(0,"ul",13),hT(1,pe$1,2,1,"li",14,pT),_l()),n&2){let t=_T();wE(),gT(t.points);}}function _e$1(n,e){if(n&1&&(zi(0,"li",14),rw(1),_l()),n&2){let t=e.$implicit;wE(),eg(t);}}function fe$1(n,e){if(n&1&&(zi(0,"ul",13),hT(1,_e$1,2,1,"li",14,pT),_l()),n&2){let t=_T();wE(),gT(t.details);}}function ve$1(n,e){if(n&1&&(zi(0,"div",10),uT(1,se$1,2,1,"p",11),uT(2,ue$1,1,2,"div",12),uT(3,ge$1,3,0,"ul",13),uT(4,fe$1,3,0,"ul",13),_l()),n&2){let t=e;wE(),dT(t.blurb?1:-1),wE(),dT(t.contentHtml?2:-1),wE(),dT(t.points!=null&&t.points.length?3:-1),wE(),dT(t.details!=null&&t.details.length?4:-1);}}function Ce$1(n,e){if(n&1&&uT(0,ve$1,5,4,"div",10),n&2){let t,i=e.$implicit,r=_T(4);dT((t=r.documentSectionFromItem(i))?0:-1,t);}}function he$1(n,e){if(n&1){let t=DT();zi(0,"app-accordion",9),Fh("itemToggle",function(r){ld(t);let d=_T(3);return ud(d.onDocumentAccordionToggle(r))})("itemSelectionToggle",function(r){ld(t);let d=_T(3);return ud(d.onDocumentAccordionSelectionToggle(r))}),_l(),ph(1,Ce$1,1,1,"ng-template",null,1,Nw);}if(n&2){let t=PT(2),i=_T(3);xh("model",i.documentAccordionModel())("itemTemplate",t);}}function we$1(n,e){if(n&1&&(zi(0,"article",6)(1,"mat-icon"),rw(2),_l(),zi(3,"h4"),rw(4),_l(),zi(5,"p"),rw(6),_l()()),n&2){let t=_T(3);wE(2),eg(t.emptyIcon()),wE(2),eg(t.emptyTitle()),wE(2),eg(t.emptyDescription());}}function be$1(n,e){if(n&1&&(zi(0,"span",16),rw(1),_l()),n&2){let t=_T(4);xh("ngClass",t.statusToneClass()),wE(),eg(t.statusMessage());}}function xe$1(n,e){if(n&1){let t=DT();zi(0,"app-menu",18),Fh("itemSelect",function(r){ld(t);let d=_T(4);return ud(d.onActionMenuSelect(r))}),_l();}if(n&2){let t=_T(4);xh("model",mw(2,de$1))("items",t.actionMenuItems());}}function ye$1(n,e){if(n&1&&(zi(0,"footer",15),uT(1,be$1,2,2,"span",16),uT(2,xe$1,1,3,"app-menu",17),_l()),n&2){let t=_T(3);zh("document-viewer-actions-single",t.visibleActions().length<=1),wE(),dT(t.statusMessage()?1:-1),wE(),dT(t.visibleActions().length>0?2:-1);}}function Se$1(n,e){if(n&1&&(zi(0,"div",4),uT(1,me$1,4,1,"article",5)(2,he$1,3,2)(3,we$1,7,3,"article",6),_l(),uT(4,ye$1,3,4,"footer",7)),n&2){let t,i=_T(2);wE(),dT(i.loading()?1:!((t=i.activeConfig())==null||t.sections==null)&&t.sections.length?2:3),wE(3),dT(i.statusMessage()||i.visibleActions().length>0?4:-1);}}function De(n,e){if(n&1&&(zi(0,"app-popup",2),kh(1,19),_l()),n&2){_T();let t=PT(1),i=_T();xh("model",i.documentPopupModel())("zIndex",2400),wE(),xh("ngTemplateOutlet",t);}}function Pe$1(n,e){if(n&1&&(zi(0,"a",22),Sh(1,"app-deployment-brand",26),_l()),n&2){let t=_T(3);wE(),xh("branding",t.deploymentBranding());}}function Me$1(n,e){if(n&1&&(zi(0,"p",14),rw(1),_l()),n&2){let t=_T(3);wE(),eg(t.description());}}function Te(n,e){if(n&1&&(zi(0,"span",25),rw(1),_l()),n&2){let t=_T(3);wE(),eg(t.versionLabel());}}function Oe(n,e){if(n&1&&(zi(0,"section",3)(1,"article",20)(2,"header",21),uT(3,Pe$1,2,1,"a",22),zi(4,"div",23)(5,"div",24)(6,"h2")(7,"span",14),rw(8),_l()(),uT(9,Me$1,2,1,"p",14),_l(),uT(10,Te,2,1,"span",25),_l()(),kh(11,19),_l()()),n&2){_T();let t=PT(1),i=_T();Nh("aria-label",i.ariaLabel()),wE(2),xh("ngClass",i.headerPaletteClass()),wE(),dT(i.showBrand()?3:-1),wE(5),eg(i.title()),wE(),dT(i.description()?9:-1),wE(),dT(i.versionLabel()?10:-1),wE(),xh("ngTemplateOutlet",t);}}function Ve(n,e){if(n&1&&(ph(0,Se$1,5,2,"ng-template",null,0,Nw),uT(2,De,2,3,"app-popup",2)(3,Oe,12,7,"section",3)),n&2){let t=_T();wE(2),dT(t.isPopupShell()?2:3);}}var oe$1=class n{deploymentConfiguration=I(b$1);deploymentBranding=this.deploymentConfiguration.branding;i18n=I(Q$1);route=I(tt);helpCenter=I(b$2);config=null;action=new Qe;openSectionId="";selectedSectionIds=new Set;initialSelectedSectionIds=new Set;selectionInputSignature="";sectionSignature="";openSectionSignature="";routeConfig=Mt(null);ngOnInit(){this.config||this.prepareRouteDocument();}ngOnChanges(e){e.config&&(this.syncSelectionFromConfig(),this.syncOpenSection());}isOpen(){return this.activeConfig()?.open!==false}shell(){return this.activeConfig()?.shell??"page"}isPopupShell(){return this.shell()==="popup"}ariaLabel(){let e=this.activeConfig();return this.uiText(e?.ariaLabel?.trim()||e?.title||"document.title")}title(){return this.uiText(this.activeConfig()?.title?.trim()||"document.title")}description(){let e=this.activeConfig()?.description?.trim()??"";return e?this.uiText(e):""}versionLabel(){return this.activeConfig()?.versionLabel?.trim()??""}headerPaletteClass(){return `document-viewer-header-${this.normalizeHeaderPalette(this.activeConfig()?.headerPalette)}`}documentPopupModel(){let e=this.activeConfig();return {title:this.title(),subtitle:this.description(),headerBadge:this.versionLabel(),ariaLabel:this.ariaLabel(),closeAriaLabel:this.closeAriaLabel(),translateTitle:false,translateSubtitle:false,translateHeaderBadge:false,closeOnBackdrop:e?.closeOnBackdrop!==false,size:"wide",height:"full",headerLayout:"document",headerPalette:this.normalizeHeaderPalette(e?.headerPalette),bodyLayout:"flush",backdropTone:"dim",onClose:t=>this.requestClose(t)}}showBrand(){return !this.isPopupShell()&&this.activeConfig()?.showBrand!==false}loading(){return this.activeConfig()?.loading===true}loadingLabel(){return this.uiText(this.activeConfig()?.loadingLabel?.trim()||"Loading document")}closeAriaLabel(){return this.uiText(this.activeConfig()?.closeAriaLabel?.trim()||"Close document")}requestClose(e){e?.stopPropagation(),this.activeConfig()?.onClose?.();}toggleSectionSelection(e,t){if(t?.preventDefault(),t?.stopPropagation(),t?.stopImmediatePropagation(),!e.toggleable)return;let i=new Set(this.selectedSectionIds);i.has(e.id)?i.delete(e.id):i.add(e.id),this.selectedSectionIds=i;}documentAccordionModel(){this.activeConfig();return {items:this.resolvedSections().map(t=>({id:t.id,title:t.title,icon:t.icon,palette:this.sectionAccordionPalette(t),open:this.openSectionId===t.id,selectable:t.toggleable===true,selected:this.isSectionSelected(t),selectionAriaLabel:this.selectionAriaLabel(t),context:t})),multi:false,labelSize:"large"}}documentSectionFromItem(e){return e.context??this.resolvedSections().find(t=>t.id===e.id)??null}onDocumentAccordionToggle(e){this.openSectionId=e.open?e.id:"";}onDocumentAccordionSelectionToggle(e){let t=this.documentSectionFromItem(e.item);t&&this.toggleSectionSelection(t,e.sourceEvent);}isSectionSelected(e){return this.selectedSectionIds.has(e.id)}sectionAccordionPalette(e){return e.tone==="mandatory"?"amber":e.tone==="optional"?"blue":"slate"}selectionAriaLabel(e){let t=e.title?.trim()||this.uiText("Section");return this.isSectionSelected(e)?this.uiText(`${t} selected`):this.uiText(`Select ${t}`)}visibleActions(){return (this.activeConfig()?.actions??[]).filter(e=>this.isActionVisible(e.visible))}actionMenuItems(){return this.visibleActions().map(e=>({id:e.id,label:e.label,icon:e.icon??void 0,kind:"action",layout:"action",palette:e.palette??"blue",disabled:e.disabled===true,progress:e.progress??null,ariaLabel:e.label}))}onActionMenuSelect(e){let t=this.visibleActions().find(i=>i.id===e.id);!t||t.disabled||this.emitDocumentAction(t,e.sourceEvent);}statusToneClass(){return this.activeConfig()?.statusTone==="error"?"document-viewer-status-message-error":"document-viewer-status-message-default"}statusMessage(){return this.activeConfig()?.statusMessage?.trim()??""}emptyIcon(){return this.activeConfig()?.emptyState?.icon?.trim()||"description"}emptyTitle(){return this.uiText(this.activeConfig()?.emptyState?.title?.trim()||"Document is not available")}emptyDescription(){return this.uiText(this.activeConfig()?.emptyState?.description?.trim()||"Document content is not available right now.")}uiText(e){return this.i18n.translateParams(e,{productName:this.deploymentBranding().productName})}syncSelectionFromConfig(){let e=this.activeConfig(),t=e?.sections??[],i=t.map(_=>`${_.id}:${_.toggleable===true}:${_.selected===true}`).join("|"),r=e?.selectedSectionIds?e.selectedSectionIds.map(_=>`${_??""}`.trim()).filter(Boolean):t.filter(_=>_.selected===true).map(_=>_.id),d=r.join("|");i===this.sectionSignature&&d===this.selectionInputSignature||(this.sectionSignature=i,this.selectionInputSignature=d,this.selectedSectionIds=new Set(r),this.initialSelectedSectionIds=new Set(r));}syncOpenSection(){let e=this.activeConfig()?.sections??[],t=e.map(r=>r.id).join("|");if(e.length===0){this.openSectionSignature="",this.openSectionId="";return}let i=t!==this.openSectionSignature;if(this.openSectionSignature=t,!i){this.openSectionId&&!e.some(r=>r.id===this.openSectionId)&&(this.openSectionId=e[0].id);return}(!this.openSectionId||!e.some(r=>r.id===this.openSectionId))&&(this.openSectionId=e[0].id);}currentSelectedSectionIds(){return Array.from(this.selectedSectionIds).sort(f$1.compareCodeUnits)}isSelectionDirty(){let e=this.currentSelectedSectionIds(),t=Array.from(this.initialSelectedSectionIds).sort(f$1.compareCodeUnits);return e.length!==t.length?true:e.some((i,r)=>i!==t[r])}isActionVisible(e){return e==="dirty"?this.isSelectionDirty():e!==false}emitDocumentAction(e,t){this.action.emit({id:e.id,action:e,selectedSectionIds:this.currentSelectedSectionIds(),sourceEvent:t??new Event(e.id)});}normalizeHeaderPalette(e){return f$1.enumValue(e,i,"amber")}activeConfig(){return this.config??this.routeConfig()}async prepareRouteDocument(){let e=this.route.snapshot.data,t=this.normalizeDocumentKind(e.documentKind);this.routeConfig.set(this.createRouteConfig(e,null,true));try{await this.helpCenter.preload(t),this.routeConfig.set(this.createRouteConfig(e,this.activeRevision(t),!1)),this.syncSelectionFromConfig(),this.syncOpenSection();}catch{this.routeConfig.set(this.createRouteConfig(e,null,false));}}createRouteConfig(e,t,i){let r=this.normalizeDocumentKind(e.documentKind);return {shell:"page",open:true,ariaLabel:e.ariaLabel?.trim()||this.defaultAriaLabel(r),title:t?.summary?.trim()||e.title?.trim()||this.defaultTitle(r),description:t?.description?.trim()||e.description?.trim()||this.defaultDescription(r),versionLabel:this.routeVersionLabel(t?.version),headerPalette:this.routeHeaderPalette(r,t?.headerColor??e.headerPalette),loading:i,loadingLabel:e.loadingLabel?.trim()||this.defaultLoadingLabel(r),emptyState:{icon:e.emptyIcon?.trim()||this.defaultEmptyIcon(r),title:e.emptyTitle?.trim()||this.defaultEmptyTitle(r),description:e.emptyDescription?.trim()||this.defaultEmptyDescription(r)},sections:(t?.sections??[]).map(d=>({id:d.id,icon:d.icon,title:d.title,blurb:d.blurb,contentHtml:d.contentHtml,points:d.points,details:d.details}))}}resolvedSections(){this.i18n.revision();let e=this.deploymentConfiguration.privacyContact(),t={dataControllerLabel:this.i18n.translate("deployment.privacy.data.controller"),privacyContactEmailLabel:this.i18n.translate("deployment.privacy.contact.email"),contactNotPublished:this.i18n.translate("deployment.privacy.contact.not.published"),deletionEmailPrefix:this.i18n.translate("deployment.privacy.deletion.email.prefix"),deletionEmailSuffix:this.i18n.translate("deployment.privacy.deletion.email.suffix")};return (this.activeConfig()?.sections??[]).map(i=>s(r$1({},i),{contentHtml:ie$2(i.contentHtml,e,t)}))}activeRevision(e){return e==="privacy"?this.helpCenter.activePrivacyRevision():e==="terms"?this.helpCenter.activeTermsRevision():this.helpCenter.activeRevision()}normalizeDocumentKind(e){return e==="privacy"||e==="terms"?e:"help"}routeVersionLabel(e){return Number.isFinite(Number(e))&&Number(e)>0?`v${Math.trunc(Number(e))}`:""}routeHeaderPalette(e,t){let i=this.normalizeHeaderPalette(t);return e==="help"&&i==="amber"?"teal":i}defaultAriaLabel(e){return e==="privacy"?"privacy.consent.aria":e==="terms"?"terms.document.aria":this.i18n.translate("help")}defaultTitle(e){return e==="privacy"?"privacy.document.title":e==="terms"?"terms.document.title":this.i18n.translate("help")}defaultDescription(e){return e==="terms"?"document.terms.description":""}defaultLoadingLabel(e){return e==="privacy"?"privacy.document.loading":e==="terms"?"terms.document.loading":"help.document.loading"}defaultEmptyIcon(e){return e==="privacy"?"policy":e==="terms"?"rule":"help_outline"}defaultEmptyTitle(e){return e==="privacy"?"privacy.document.unavailable.title":e==="terms"?"terms.document.unavailable.title":"help.document.unavailable.title"}defaultEmptyDescription(e){return e==="privacy"?"privacy.document.unavailable.description":e==="terms"?"terms.document.unavailable.description":"help.document.unavailable.description"}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=ID({type:n,selectors:[["app-document-viewer"]],inputs:{config:"config"},outputs:{action:"action"},features:[jy],decls:1,vars:1,consts:[["documentViewerBody",""],["documentSectionTemplate",""],[3,"model","zIndex"],[1,"document-viewer-page"],[1,"document-viewer-content"],[1,"document-viewer-status","document-viewer-status-loading"],[1,"document-viewer-status"],[1,"document-viewer-actions",3,"document-viewer-actions-single"],["kind","load-ring","state","loading"],[1,"document-viewer-accordion",3,"itemToggle","itemSelectionToggle","model","itemTemplate"],[1,"document-viewer-section-body"],["data-i18n-ignore","",1,"document-viewer-lead"],["appLazyBgImage","","data-i18n-ignore","",1,"document-viewer-html",3,"appLazyHtmlImages","innerHTML"],[1,"document-viewer-list"],["data-i18n-ignore",""],[1,"document-viewer-actions"],["role","status",1,"document-viewer-status-message",3,"ngClass"],["kind","inline","layout","row",1,"document-viewer-action-menu",3,"model","items"],["kind","inline","layout","row",1,"document-viewer-action-menu",3,"itemSelect","model","items"],[3,"ngTemplateOutlet"],[1,"document-viewer-page-panel"],[1,"document-viewer-head",3,"ngClass"],["href","/",1,"document-viewer-brand"],[1,"document-viewer-head-row"],[1,"document-viewer-title-wrap"],[1,"document-viewer-version"],[3,"branding"]],template:function(t,i){t&1&&uT(0,Ve,4,1),t&2&&dT(i.isOpen()?0:-1);},dependencies:[Gt,bn,Rn,Wi,Gi,xi,dC,yC,On,Ge,lf],styles:["[_nghost-%COMP%]{display:contents}.document-viewer-page[_ngcontent-%COMP%]{box-sizing:border-box;min-height:0;height:100vh;overflow:hidden;display:grid;place-items:stretch;background:radial-gradient(circle at top left,rgba(80,96,125,.12),transparent 34rem),linear-gradient(180deg,#f8fbff,#fff 46%,#f7f8fc);color:#172033;padding:36px 16px 64px}.document-viewer-page-panel[_ngcontent-%COMP%]{position:relative;z-index:1;overflow:hidden;display:grid;grid-template-rows:auto minmax(0,1fr) auto;border:1px solid rgba(198,210,226,.92);background:#fff;color:#172033}.document-viewer-page-panel[_ngcontent-%COMP%]{width:min(920px,100%);height:100%;min-height:0;margin:0 auto;border:1px solid rgba(35,45,72,.1);border-radius:14px;box-shadow:0 18px 58px #2d395624}.document-viewer-head[_ngcontent-%COMP%]{--document-viewer-header-bg: linear-gradient(180deg, #eef3f8 0%, #f8fafc 100%);--document-viewer-header-border: rgba(72, 92, 118, .24);--document-viewer-header-title: #304157;--document-viewer-header-text: rgba(48, 65, 87, .78);--document-viewer-header-pill-bg: #40566f;border-bottom:1px solid var(--document-viewer-header-border);background:var(--document-viewer-header-bg)}.document-viewer-header-amber[_ngcontent-%COMP%]{--document-viewer-header-bg: linear-gradient(180deg, #fbf4e8 0%, #fffaf0 100%);--document-viewer-header-border: rgba(157, 118, 41, .24);--document-viewer-header-title: #7c5618;--document-viewer-header-text: rgba(108, 74, 19, .84);--document-viewer-header-pill-bg: #b66a15}.document-viewer-header-blue[_ngcontent-%COMP%]{--document-viewer-header-bg: linear-gradient(180deg, #eef6ff 0%, #f8fbff 100%);--document-viewer-header-border: rgba(53, 96, 162, .24);--document-viewer-header-title: #1f3f6f;--document-viewer-header-text: rgba(46, 78, 119, .84);--document-viewer-header-pill-bg: #2f6fae}.document-viewer-header-green[_ngcontent-%COMP%]{--document-viewer-header-bg: linear-gradient(180deg, #f0fbf3 0%, #e4f7ea 100%);--document-viewer-header-border: rgba(58, 143, 91, .3);--document-viewer-header-title: #246b42;--document-viewer-header-text: rgba(35, 94, 58, .84);--document-viewer-header-pill-bg: #1f7a49}.document-viewer-header-teal[_ngcontent-%COMP%]{--document-viewer-header-bg: linear-gradient(180deg, #eefafa 0%, #f7fdfd 100%);--document-viewer-header-border: rgba(33, 126, 132, .24);--document-viewer-header-title: #17646d;--document-viewer-header-text: rgba(28, 91, 99, .84);--document-viewer-header-pill-bg: #197987}.document-viewer-header-rose[_ngcontent-%COMP%]{--document-viewer-header-bg: linear-gradient(180deg, #fff1f4 0%, #fff8fa 100%);--document-viewer-header-border: rgba(178, 69, 98, .26);--document-viewer-header-title: #8c2e49;--document-viewer-header-text: rgba(122, 45, 70, .84);--document-viewer-header-pill-bg: #b94462}.document-viewer-header-violet[_ngcontent-%COMP%]{--document-viewer-header-bg: linear-gradient(180deg, #f5f0ff 0%, #fbf8ff 100%);--document-viewer-header-border: rgba(107, 80, 175, .26);--document-viewer-header-title: #50398e;--document-viewer-header-text: rgba(75, 52, 128, .84);--document-viewer-header-pill-bg: #6b50af}.document-viewer-header-slate[_ngcontent-%COMP%]{--document-viewer-header-bg: linear-gradient(180deg, #eef3f8 0%, #f8fafc 100%);--document-viewer-header-border: rgba(72, 92, 118, .24);--document-viewer-header-title: #304157;--document-viewer-header-text: rgba(48, 65, 87, .78);--document-viewer-header-pill-bg: #40566f}.document-viewer-brand[_ngcontent-%COMP%]{display:inline-flex;align-items:center;gap:10px;width:fit-content;margin:18px 20px 0;color:inherit;text-decoration:none;font-weight:800;font-size:1.2rem;--deployment-brand-logo-size: 40px;--deployment-brand-gap: 10px}.document-viewer-brand[_ngcontent-%COMP%]   app-deployment-brand[_ngcontent-%COMP%]{filter:drop-shadow(0 8px 11px rgba(71,68,158,.18))}.document-viewer-head-row[_ngcontent-%COMP%]{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:16px;align-items:start;padding:18px 20px}.document-viewer-title-wrap[_ngcontent-%COMP%]{min-width:0}.document-viewer-title-wrap[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%], .document-viewer-title-wrap[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{margin:0}.document-viewer-title-wrap[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%]{color:var(--document-viewer-header-title);font-size:1.45rem;line-height:1.12}.document-viewer-title-wrap[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{margin-top:6px;color:var(--document-viewer-header-text);line-height:1.45;font-weight:400}.document-viewer-version[_ngcontent-%COMP%]{align-self:start;border-radius:999px;background:var(--document-viewer-header-pill-bg);color:#fff;padding:5px 10px;font-size:.78rem;font-weight:800}.document-viewer-content[_ngcontent-%COMP%]{flex:1 1 auto;overflow:auto;min-height:0;padding:18px;background:#f8fbff}.document-viewer-accordion[_ngcontent-%COMP%]{display:block}.document-viewer-section-body[_ngcontent-%COMP%]{padding:.1rem .25rem .2rem;color:#33405a;line-height:1.62}.document-viewer-lead[_ngcontent-%COMP%]{margin:0 0 12px;color:#4b5872;line-height:1.58}.document-viewer-html[_ngcontent-%COMP%]   :is(p[_ngcontent-%COMP%], ul[_ngcontent-%COMP%], ol[_ngcontent-%COMP%]){margin:0 0 12px;color:#26374f;line-height:1.55}.document-viewer-html[_ngcontent-%COMP%]   :is(h3[_ngcontent-%COMP%], h4[_ngcontent-%COMP%]){margin:18px 0 10px;color:#172033}.document-viewer-html[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%], .document-viewer-html[_ngcontent-%COMP%]   ol[_ngcontent-%COMP%], .document-viewer-list[_ngcontent-%COMP%]{display:grid;gap:8px;margin:0 0 12px;padding-left:1.2rem;color:#26374f}.document-viewer-html[_ngcontent-%COMP%]   :is(figure[_ngcontent-%COMP%]){margin:.85rem 0}.document-viewer-html[_ngcontent-%COMP%]   :is(img[_ngcontent-%COMP%]){max-width:100%;height:auto;border-radius:8px}.document-viewer-status[_ngcontent-%COMP%]{display:grid;place-items:center;min-height:220px;border:1px dashed rgba(83,105,139,.24);border-radius:8px;background:#f7fafed1;color:#2c3f5cb8;text-align:center;padding:2rem}.document-viewer-status[_ngcontent-%COMP%]   h4[_ngcontent-%COMP%], .document-viewer-status[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{margin:0}.document-viewer-status[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{margin-bottom:.45rem;color:#6d86a8}.document-viewer-status-loading[_ngcontent-%COMP%]{gap:.7rem;min-height:180px;font-weight:800}.document-viewer-actions[_ngcontent-%COMP%]{display:flex;align-items:center;justify-content:flex-end;gap:12px;border-top:1px solid rgba(35,45,72,.1);background:#fff;padding:14px 18px}.document-viewer-actions-single[_ngcontent-%COMP%]{justify-content:flex-end}.document-viewer-status-message[_ngcontent-%COMP%]{margin-right:auto;font-size:.9rem;font-weight:700}.document-viewer-status-message-default[_ngcontent-%COMP%]{color:#244168b8}.document-viewer-status-message-error[_ngcontent-%COMP%]{color:#9b2c37}.document-viewer-action-menu[_ngcontent-%COMP%]{display:inline-flex}@media(max-width:760px){.document-viewer-page[_ngcontent-%COMP%]{padding:0}.document-viewer-page-panel[_ngcontent-%COMP%]{width:100vw;height:100vh;max-height:none;min-height:0;border-radius:0;border-inline:0}.document-viewer-head-row[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) max-content;gap:10px}.document-viewer-version[_ngcontent-%COMP%]{justify-self:start}.document-viewer-content[_ngcontent-%COMP%]{padding:.8rem}.document-viewer-actions[_ngcontent-%COMP%]{align-items:stretch;flex-direction:column}.document-viewer-status-message[_ngcontent-%COMP%]{margin-right:0}.document-viewer-action-menu[_ngcontent-%COMP%]{align-self:flex-end}}"]})};var chunk4Z6VRNA4=/*#__PURE__*/Object.freeze({__proto__:null,DocumentViewerComponent:oe$1});var R$1=s=>[s],q=(s,p)=>p.id;function U(s,p){if(s&1){let e=DT();zi(0,"div",19),bw(1,"i18n"),bw(2,"i18n"),zi(3,"span",12)(4,"mat-icon",13),rw(5),_l()(),zi(6,"app-menu",20),Fh("itemSelect",function(n){ld(e);let c=_T(2);return ud(c.toggle(n))}),_l()();}if(s&2){let e=p.$implicit,o=_T(2),n=e.id==="location"?!o.store.locationSetupMissing():o.store.messaging.deviceNotificationsEnabled(),c=e.id==="notifications"&&!o.store.notificationConfigurationPending()&&!o.store.messaging.notificationsConfigured;zh("is-complete",n)("is-blocked",!n&&c),Nh("data-step",e.id)("aria-label",Mw(1,9,"app.setup."+e.id)+": "+Mw(2,11,n?"done":c?"blocked":"pending")),wE(5),eg(n?"check":c?"block":"priority_high"),wE(),xh("items",yw(13,R$1,e)),Nh("data-guide-field",e.id);}}function W(s,p){if(s&1&&(zi(0,"section",22)(1,"h3")(2,"mat-icon",13),rw(3),_l(),rw(4),bw(5,"i18n"),_l(),zi(6,"p"),rw(7),bw(8,"i18n"),_l()()),s&2){let e=p.$implicit;Nh("data-tone",e.tone),wE(3),eg(e.icon),wE(),eg(Mw(5,4,"app.setup.help."+e.id+".title")),wE(3),eg(Mw(8,6,"app.setup.help."+e.id+".text"));}}function Y(s,p){if(s&1){let e=DT();zi(0,"app-popup",0),Fh("close",function(){ld(e);let n=_T(2);return ud(n.helpOpen.set(false))}),zi(1,"div",21),hT(2,W,9,8,"section",22,q),_l()();}if(s&2){let e=_T(2);xh("model",e.helpModel),wE(2),gT(e.helpSections);}}function J$1(s,p){if(s&1){let e=DT();zi(0,"app-popup",0),Fh("close",function(){ld(e);let n=_T();return ud(n.store.close())}),zi(1,"div",1)(2,"section",2)(3,"h3",3),rw(4),bw(5,"i18n"),_l(),zi(6,"p"),rw(7),bw(8,"i18n"),_l(),zi(9,"app-menu",4),Fh("itemSelect",function(n){ld(e);let c=_T();return ud(c.action(n))}),_l()(),zi(10,"div",5)(11,"section",6)(12,"h3",7),rw(13),bw(14,"i18n"),_l(),zi(15,"p"),rw(16),bw(17,"i18n"),_l(),hT(18,U,7,15,"div",8,q),_l(),zi(20,"section",9)(21,"h3",10),rw(22),bw(23,"i18n"),_l(),zi(24,"p"),rw(25),bw(26,"i18n"),_l(),zi(27,"div",11),bw(28,"i18n"),bw(29,"i18n"),zi(30,"span",12)(31,"mat-icon",13),rw(32),_l()(),zi(33,"app-menu",14),Fh("itemSelect",function(n){ld(e);let c=_T();return ud(c.action(n))}),_l()()(),zi(34,"section",15),bw(35,"i18n"),zi(36,"div",16),bw(37,"i18n"),bw(38,"i18n"),zi(39,"span",12)(40,"mat-icon",13),rw(41),_l()(),zi(42,"app-menu",17),Fh("itemSelect",function(n){ld(e);let c=_T();return ud(c.action(n))}),_l()()()()()(),uT(43,Y,4,1,"app-popup",18);}if(s&2){let e=_T();xh("model",e.model()),wE(4),eg(Mw(5,25,"app.setup.open.browser")),wE(3),eg(Mw(8,27,"app.setup.open.browser.help")),wE(2),xh("model",e.actionModel)("items",e.browserActions),wE(4),eg(Mw(14,29,"app.setup.permissions")),wE(3),eg(Mw(17,31,"app.setup.permission.help")),wE(2),gT(e.toggles()),wE(4),eg(Mw(23,33,"install.app")),wE(3),eg(Mw(26,35,"app.setup.description"));let o=e.store.pwa.installed(),n=!e.store.pwa.installAvailable()&&!e.store.pwa.installActionPending(),c=o?e.installedActions:e.installActions();wE(2),zh("is-complete",o)("is-blocked",!o&&n),Nh("aria-label",Mw(28,37,"install.app")+": "+Mw(29,39,o?"done":n?"blocked":"pending")),wE(5),eg(o?"check":n?"block":"priority_high"),wE(),xh("model",e.actionModel)("items",c),wE(),Nh("aria-label",Mw(35,41,"privacy"));let v=!e.store.privacyMissing();wE(2),zh("is-complete",v),Nh("aria-label",Mw(37,43,"privacy")+": "+Mw(38,45,v?"done":"pending")),wE(5),eg(v?"check":"priority_high"),wE(),xh("model",e.actionModel)("items",e.privacyActions()),wE(),dT(e.helpOpen()?43:-1);}}var $$1=class s{store=I(y);i18n=I(Q$1);helpOpen=Mt(false);actionModel={actionSizing:"content"};browserActions=[{id:"open-browser",icon:"open_in_browser",layout:"pill",label:"app.setup.open.browser",palette:"ink"}];privacyActions=At(()=>[{id:"privacy",icon:"policy",layout:"pill",label:"privacy",palette:this.store.privacyMissing()?"blue":"green",counter:this.store.privacyMissing()?1:null,counterTone:"alert",disabled:this.store.actionPending()}]);installedActions=[{id:"install",icon:"install_desktop",layout:"pill",label:"install.app",palette:"green",disabled:true}];model=At(()=>({errorMessage:this.store.error(),title:"app.setup.title",size:"small",height:"auto",mobilePresentation:"fullscreen",headerTone:"accent",headerPalette:"violet",showClose:true,closeOnBackdrop:false,backdropTone:"dim",headerActions:[{id:"help",icon:"question_mark",palette:"blue",ariaLabel:this.i18n.translate("app.setup.help.title")}],onAction:()=>this.helpOpen.set(true)}));helpModel={title:"app.setup.help.title",size:"default",height:"auto",headerTone:"accent",headerPalette:"blue",showClose:true,backdropTone:"dim"};helpSections=[{id:"location",icon:"location_on",tone:"blue"},{id:"notifications",icon:"notifications",tone:"violet"},{id:"install",icon:"install_mobile",tone:"green"},{id:"blocked",icon:"block",tone:"rose"},{id:"android",icon:"android",tone:"teal"},{id:"ios",icon:"phone_iphone",tone:"orange"}];toggles=At(()=>[{id:"location",kind:"toggle",layout:"pill",icon:"location_on",label:"app.setup.location",palette:"blue",togglePalette:this.store.locationPermission()==="granted"?"green":this.store.locationPermission()==="denied"?"red":this.store.locationSelected()?"blue":"slate",checked:this.store.locationSelected(),showToggleIndicator:true,progress:this.controlProgress("location"),disabled:this.store.actionPending()||this.store.locationPermissionPending()},{id:"notifications",kind:"toggle",layout:"pill",icon:"notifications",label:"app.setup.notifications",palette:"violet",togglePalette:this.store.notificationsSelected()&&this.store.messaging.notificationPermission()==="granted"?"green":this.store.messaging.notificationPermission()==="denied"?"red":this.store.notificationsSelected()?"blue":"slate",checked:this.store.notificationsSelected(),showToggleIndicator:true,progress:this.controlProgress("notifications"),disabled:this.store.actionPending()||this.store.notificationConfigurationPending()||!this.store.messaging.notificationsConfigured}]);installActions=At(()=>[{id:"install",icon:"install_desktop",layout:"pill",label:"install.app",palette:"violet",disabled:!this.store.pwa.installAvailable()||this.store.actionPending()||this.store.pwa.installActionPending(),progress:{state:this.store.pwa.installBusy()?"loading":null}}]);controlProgress(p){let e=this.store.activeControl()===p;return e&&this.store.busy()?r$1({state:"loading",shape:"button",perimeter:100},this.store.busy()?{durationMs:v.locationRequestTimeoutMs}:{}):e&&this.store.error()?{state:"error",shape:"button"}:e&&this.store.saveSucceeded()?{state:"success",shape:"button",durationMs:1e3}:null}constructor(){Ga(()=>{this.store.isOpen()||this.helpOpen.set(false);});}refreshPermissions(){this.store.isOpen()&&this.store.refreshPermissions();}toggle(p){this.store.actionPending()||(p.id==="location"?this.store.toggleLocation():p.id==="notifications"&&this.store.toggleNotifications());}action(p){p.id==="install"?this.store.install():p.id==="open-browser"?this.store.pwa.openInBrowser():p.id==="privacy"&&this.store.openPrivacy();}static \u0275fac=function(e){return new(e||s)};static \u0275cmp=ID({type:s,selectors:[["app-setup-popup"]],hostBindings:function(e,o){e&1&&Fh("focus",function(){return o.refreshPermissions()},sE);},decls:1,vars:1,consts:[[3,"close","model"],["appLandingGuideSurface","landing.setup",1,"app-setup-content"],["aria-labelledby","setup-browser",1,"app-setup-section","app-setup-browser"],["id","setup-browser"],["kind","inline",1,"app-setup-toggle","app-setup-action",3,"itemSelect","model","items"],[1,"app-setup-checklist"],["aria-labelledby","setup-permissions",1,"app-setup-section"],["id","setup-permissions"],["role","group",1,"app-setup-step",3,"is-complete","is-blocked"],["aria-labelledby","setup-install",1,"app-setup-section","app-setup-install"],["id","setup-install"],["data-step","install","role","group",1,"app-setup-step"],[1,"app-setup-step-badge"],["aria-hidden","true"],["kind","inline","data-guide-field","install",1,"app-setup-toggle","app-setup-action",3,"itemSelect","model","items"],[1,"app-setup-section","app-setup-privacy"],["data-step","privacy","role","group",1,"app-setup-step"],["kind","inline","data-guide-field","privacy",1,"app-setup-toggle","app-setup-action",3,"itemSelect","model","items"],[3,"model"],["role","group",1,"app-setup-step"],["kind","inline",1,"app-setup-toggle",3,"itemSelect","items"],[1,"app-setup-help"],[1,"app-setup-help-card"]],template:function(e,o){e&1&&uT(0,J$1,44,47),e&2&&dT(o.store.isOpen()?0:-1);},dependencies:[m,lf,Ge,Wi,Gi,si],styles:['[_nghost-%COMP%]{--app-popup-small-width: 340px}.app-setup-content[_ngcontent-%COMP%], .app-setup-section[_ngcontent-%COMP%]{display:grid;grid-template-columns:minmax(0,1fr);min-width:0;gap:.65rem}.app-setup-content[_ngcontent-%COMP%]{padding:.5rem;color:#28415f;line-height:1.4}h3[_ngcontent-%COMP%], p[_ngcontent-%COMP%]{margin:0}h3[_ngcontent-%COMP%]{font-size:.95rem}p[_ngcontent-%COMP%]{font-size:.9rem;overflow-wrap:anywhere}.app-setup-install[_ngcontent-%COMP%]{border-top:1px solid #dce3ed;padding-top:.8rem;margin-top:.3rem}.app-setup-error[_ngcontent-%COMP%]{color:#a32035}app-menu[_ngcontent-%COMP%]{max-width:100%}.app-setup-action[_ngcontent-%COMP%]{justify-self:stretch}.app-setup-toggle[_ngcontent-%COMP%]{--app-menu-row-width: 100%;--app-menu-row-justify: flex-start;--app-menu-row-item-width: min(14rem, 100%);--app-menu-row-item-justify: space-between}.app-setup-help[_ngcontent-%COMP%]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;padding:.25rem;color:#28415f;line-height:1.45}.app-setup-help-card[_ngcontent-%COMP%]{--help-accent: #315fcf;--help-soft: #eef5ff;min-width:0;padding:.8rem;border:1px solid color-mix(in srgb,var(--help-accent) 34%,transparent);border-radius:14px;background:linear-gradient(155deg,var(--help-soft),#fff 76%)}.app-setup-help-card[data-tone=violet][_ngcontent-%COMP%]{--help-accent: #7247db;--help-soft: #f4efff}.app-setup-help-card[data-tone=green][_ngcontent-%COMP%]{--help-accent: #176b47;--help-soft: #ecfaf2}.app-setup-help-card[data-tone=rose][_ngcontent-%COMP%]{--help-accent: #b85072;--help-soft: #fff0f4}.app-setup-help-card[data-tone=teal][_ngcontent-%COMP%]{--help-accent: #167887;--help-soft: #eaf9fb}.app-setup-help-card[data-tone=orange][_ngcontent-%COMP%]{--help-accent: #a94808;--help-soft: #fff3e8}.app-setup-help-card[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{display:flex;align-items:center;gap:.5rem;color:var(--help-accent);margin-bottom:.5rem}.app-setup-help-card[_ngcontent-%COMP%]   mat-icon[_ngcontent-%COMP%]{flex:0 0 auto}@media(max-width:600px){.app-setup-help[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr)}}.app-setup-browser[_ngcontent-%COMP%]{padding:.8rem;border:2px solid #1e40af;border-radius:12px;background:#eff6ff;color:#172554}.app-setup-browser[_ngcontent-%COMP%]   p[_ngcontent-%COMP%]{font-weight:600}.app-setup-privacy[_ngcontent-%COMP%]{border-top:1px solid #dce3ed;padding-top:.8rem;margin-top:.3rem}.app-setup-checklist[_ngcontent-%COMP%]{display:grid;gap:.65rem;position:relative;padding-left:36px}.app-setup-checklist[_ngcontent-%COMP%]:before{content:"";position:absolute;left:11px;top:12px;bottom:19px;width:2px;background:#cbd5e1}.app-setup-step[_ngcontent-%COMP%]{position:relative;min-width:0}.app-setup-step-badge[_ngcontent-%COMP%]{position:absolute;left:-36px;top:50%;transform:translateY(-50%);display:grid;place-items:center;width:24px;height:24px;border:1px solid #bf701c;border-radius:50%;background:#fff4df;color:#8c4908}.app-setup-step-badge[_ngcontent-%COMP%]   mat-icon[_ngcontent-%COMP%]{display:block;font-size:18px;line-height:18px;width:18px;height:18px}.app-setup-step.is-complete[_ngcontent-%COMP%]   .app-setup-step-badge[_ngcontent-%COMP%]{background:#eaf8f0;border-color:#399467;color:#176b47}.app-setup-step.is-blocked[_ngcontent-%COMP%]   .app-setup-step-badge[_ngcontent-%COMP%]{background:#fff0f2;border-color:#c93240;color:#ad2030}']})};var chunkDKRIDDZA=/*#__PURE__*/Object.freeze({__proto__:null,AppSetupPopupComponent:$$1});var L=["providerFrame"];function R(n,t){if(n&1&&(zi(0,"app-popup",1),Sh(1,"iframe",2,0),bw(3,"i18n"),_l()),n&2){let e=_T();xh("model",e.popupModel())("zIndex",25200),wE(),xh("src",t,rE),Nh("title",Mw(3,4,"payment.authorization.waiting.title"));}}var F=class n{providerFrame;authorization=I(p);sanitizer=I(ar);sourceUrl=At(()=>{let t=this.authorization.waitingSurface()?.url;return t?this.sanitizer.bypassSecurityTrustResourceUrl(t):null});popupModel(){return {title:"payment.authorization.waiting.title",subtitle:"payment.authorization.waiting.subtitle",ariaLabel:"payment.authorization.waiting.title",closeAriaLabel:"close",size:"wide",height:"full",headerTone:"accent",bodyLayout:"flush",closeOnBackdrop:false,onClose:()=>this.authorization.closeWaitingSurface()}}onProviderMessage(t){let e=this.authorization.waitingSurface();if(!e||t.source!==this.providerFrame?.nativeElement.contentWindow)return;let o="";try{o=new URL(e.url,window.location.href).origin;}catch{return}let i=t.data;t.origin!==o||i?.source!=="myscoutee-payment-simulator"||i.type!=="payment-authorization"||this.authorization.receiveProviderStatus(`${i.id??""}`,`${i.status??""}`);}static \u0275fac=function(e){return new(e||n)};static \u0275cmp=ID({type:n,selectors:[["app-payment-authorization-popup"]],viewQuery:function(e,o){if(e&1&&Bh(L,5),e&2){let i;AT(i=kT())&&(o.providerFrame=i.first);}},hostBindings:function(e,o){e&1&&Fh("message",function(E){return o.onProviderMessage(E)},sE);},decls:1,vars:1,consts:[["providerFrame",""],["guideContext","admin.payment-authorizations",1,"payment-authorization-popup",3,"model","zIndex"],["sandbox","allow-scripts allow-same-origin",1,"payment-authorization-popup__frame",3,"src"]],template:function(e,o){if(e&1&&uT(0,R,4,6,"app-popup",1),e&2){let i;dT((i=o.authorization.waitingSurface()&&o.sourceUrl())?0:-1,i);}},dependencies:[lf,si],styles:["[_nghost-%COMP%]{display:contents}.payment-authorization-popup__frame[_ngcontent-%COMP%]{display:block;width:100%;height:100%;min-height:26rem;border:0;background:#eef3f9}"]})};var chunkTHU2G7JH=/*#__PURE__*/Object.freeze({__proto__:null,PaymentAuthorizationPopupComponent:F});var oe=(i,e)=>e.id;function ie$1(i,e){i&1&&(zi(0,"img",17),Fh("load",function(o){return o.target.classList.add("is-loaded")})("error",function(o){return o.target.classList.remove("is-loaded")}),_l()),i&2&&xh("src",e,nE);}function ne(i,e){if(i&1&&rw(0),i&2){let t=_T(2),o=_T(3);Al(" ",o.userAvatarLabel(t)," ");}}function re(i,e){if(i&1&&(zi(0,"span",12),Sh(1,"span",14),zi(2,"span",15),uT(3,ie$1,1,1,"img",16)(4,ne,1,1),_l()()),i&2){let t,o=_T(),l=_T(3);wE(2),zh("has-photo",!!l.userAvatarUrl(o)),xh("ngClass",l.userAvatarClass(o)),wE(),dT((t=l.userAvatarUrl(o))?3:4,t);}}function se(i,e){if(i&1&&(zi(0,"div",6),uT(1,re,5,4,"span",12),zi(2,"span",13)(3,"strong"),rw(4),_l(),zi(5,"small"),rw(6),bw(7,"i18n"),_l()()()),i&2){let t=e,o=_T(3);wE(),dT(o.userAvatarUrl(t)||o.userAvatarLabel(t)?1:-1),wE(3),eg(t.name),wE(2),eg(Mw(7,3,"demo.selector.selection.automatic"));}}function ae(i,e){if(i&1&&Sh(0,"app-indicator",9),i&2){let t=_T(3);xh("durationMs",t.userListLoadDurationMs());}}function le(i,e){if(i&1&&Sh(0,"app-indicator",10),i&2){let t=_T(3);xh("position",t.loading?t.loadingPosition():0);}}function de(i,e){if(i&1&&(zi(0,"p",11),rw(1),_l()),i&2){let t=_T(3);wE(),Al("",t.loadingProgress,"%");}}function ce(i,e){if(i&1&&(zi(0,"div",2)(1,"div",3)(2,"div",4)(3,"p",5),rw(4),bw(5,"i18n"),_l(),uT(6,se,8,5,"div",6),zi(7,"p",7),rw(8),bw(9,"i18n"),_l(),zi(10,"div",8),bw(11,"i18n"),uT(12,ae,1,1,"app-indicator",9)(13,le,1,1,"app-indicator",10),_l(),uT(14,de,2,1,"p",11),_l()()()),i&2){let t,o=_T(2);wE(4),Al(" ",Mw(5,9,o.submitting?"demo.session.opening.title":"demo.selector.loading.title")," "),wE(2),dT((t=o.submitting&&o.selectedUser())?6:-1,t),wE(2),eg(Mw(9,11,o.submitting&&!o.loading?"demo.session.opening.description":o.loadingLabel)),wE(2),Nh("aria-label",Mw(11,13,"demo.bootstrap.progress.aria"))("aria-valuemin",0)("aria-valuemax",100)("aria-valuenow",o.loadingUserList||!o.loading?null:o.loadingProgress),wE(2),dT(o.loadingUserList?12:13),wE(2),dT(o.loading&&!o.loadingUserList?14:-1);}}function me(i,e){if(i&1){let t=DT();zi(0,"div",2)(1,"div",3)(2,"div",4)(3,"p",5),rw(4),bw(5,"i18n"),_l(),zi(6,"p",7),rw(7),bw(8,"i18n"),_l(),zi(9,"button",19),Fh("click",function(){ld(t);let l=_T(3);return ud(l.requestRetry())}),rw(10),bw(11,"i18n"),_l()()()();}if(i&2){let t=_T(3);wE(4),eg(Mw(5,4,"demo.selector.unavailable.title")),wE(3),eg(Mw(8,6,t.errorMessage)),wE(2),xh("disabled",t.submitting),wE(),Al(" ",Mw(11,8,"try.again")," ");}}function pe(i,e){i&1&&(zi(0,"img",17),Fh("load",function(o){return o.target.classList.add("is-loaded")})("error",function(o){return o.target.classList.remove("is-loaded")}),_l()),i&2&&xh("src",e,nE);}function ue(i,e){if(i&1&&rw(0),i&2){let t=_T(2).$implicit,o=_T(4);Al(" ",o.userAvatarLabel(t)," ");}}function ge(i,e){if(i&1&&(zi(0,"span",15),uT(1,pe,1,1,"img",16)(2,ue,1,1),_l()),i&2){let t,o=_T().$implicit,l=_T(4);zh("has-photo",!!l.userAvatarUrl(o)),xh("ngClass",l.userAvatarClass(o)),wE(),dT((t=l.userAvatarUrl(o))?1:2,t);}}function _e(i,e){if(i&1&&(zi(0,"span",23),rw(1),_l()),i&2){let t=_T().$implicit;wE(),eg(t.name.trim());}}function he(i,e){i&1&&(zi(0,"span",24),rw(1),bw(2,"i18n"),_l()),i&2&&(wE(),eg(Mw(2,1,"new.demo.profile")));}function Ce(i,e){i&1&&(zi(0,"span"),rw(1),bw(2,"i18n"),_l()),i&2&&(wE(),eg(Mw(2,1,"needs.setup")));}function fe(i,e){if(i&1&&(zi(0,"span",28),rw(1),_l()),i&2){let t=_T(2).$implicit;wE(),eg(t.city.trim());}}function xe(i,e){i&1&&(zi(0,"span",29),rw(1),bw(2,"i18n"),_l()),i&2&&(wE(),eg(Mw(2,1,"needs.setup")));}function be(i,e){if(i&1&&(zi(0,"span"),rw(1),bw(2,"i18n"),_l(),zi(3,"span",27),rw(4," \xB7 "),_l(),uT(5,fe,2,1,"span",28)(6,xe,3,3,"span",29)),i&2){let t=_T().$implicit,o=_T(4);wE(),eg(Mw(2,2,o.userGenderLabel(t))),wE(4),dT(t.city.trim()?5:6);}}function Se(i,e){if(i&1&&(zi(0,"span",26),rw(1),bw(2,"i18n"),_l()),i&2){let t=_T().$implicit,o=_T(4);wE(),eg(Mw(2,1,o.userStatusLabel(t)));}}function ve(i,e){if(i&1){let t=DT();zi(0,"button",21),Fh("click",function(){let l=ld(t).$implicit,c=_T(4);return ud(c.requestUserSelect(l.id))}),uT(1,ge,3,4,"span",22),uT(2,_e,2,1,"span",23)(3,he,3,3,"span",24),zi(4,"span",25),uT(5,Ce,3,3,"span")(6,be,7,4),_l(),uT(7,Se,3,3,"span",26),_l();}if(i&2){let t=e.$implicit,o=_T(4);zh("demo-user-item-selected",o.selectedUserId.trim()===t.id.trim()),xh("ngClass",o.userStatusClass(t))("disabled",o.submitting)("matRippleColor","rgba(72, 111, 196, 0.16)"),Nh("data-user-id",t.id),wE(),dT(o.userAvatarUrl(t)||o.userAvatarLabel(t)?1:-1),wE(),dT(t.name.trim()?2:3),wE(3),dT(o.isNewProfile(t)?5:6),wE(2),dT(o.userStatusLabel(t)?7:-1);}}function Me(i,e){if(i&1&&(zi(0,"div",18),hT(1,ve,8,10,"button",20,oe),_l()),i&2){let t=_T(3);wE(),gT(t.visibleUsers());}}function Pe(i,e){i&1&&(zi(0,"div",2)(1,"p",7),rw(2),bw(3,"i18n"),_l()()),i&2&&(wE(2),eg(Mw(3,1,"demo.selector.empty.description")));}function ye(i,e){if(i&1&&uT(0,me,12,10,"div",2)(1,Me,3,0,"div",18)(2,Pe,4,3,"div",2),i&2){let t=_T(2);dT(t.errorMessage?0:t.visibleUsers().length>0?1:2);}}function we(i,e){if(i&1&&(zi(0,"app-popup",0)(1,"div",1),uT(2,ce,15,15,"div",2)(3,ye,3,1),_l()()),i&2){let t=_T();xh("model",t.popupModel())("zIndex",2800),wE(2),dT(t.loading?2:3);}}var te$1=class i{i18n=I(Q$1);demoBootstrapSelectorStore=I(u);usersService=I(ye$2);injector=I(ge$2);changeDetectorRef=I(jF);ngZone=I(Me$2);contextRequest=null;contextRequestToken=0;contextControlled=false;contextSelectorSeedReady=false;selectedMode="member";open=false;loading=false;loadingProgress=0;loadingLabel="demo.bootstrap.loading";loadingStage="selector";loadingUserList=false;errorMessage="";submitting=false;users=[];title="select.demo.user";subtitle="demo.selector.subtitle";selectedUserId="";closeRequested=new Qe;retryRequested=new Qe;userSelected=new Qe;newProfileRequested=new Qe;constructor(){Ga(()=>{let e=this.demoBootstrapSelectorStore.demoBootstrapSelector();if(!e){this.resetContextState();return}this.openContextRequest(e);});}onGlobalEscape(e){if(!this.open||!this.contextRequest)return;let t=e;t.defaultPrevented||(t.stopPropagation(),this.requestClose());}requestClose(){if(!this.submitting){if(this.contextRequest){this.contextRequest.onClose?.();return}this.closeRequested.emit();}}popupModel(){let e=[],t=this.newProfileMenuItems();t.length>0&&e.push({id:"new-profile",kind:"menu",menuKind:"inline",items:t});let o=this.selectorRoleMenuItems();return o.length>0&&e.push({id:"selector-role",kind:"menu",menuKind:"select",trigger:this.selectorRoleMenuTrigger(),items:o,panelAlign:"end"}),{title:this.title,subtitle:this.subtitle,ariaLabel:"demo.selector.aria",closeAriaLabel:"demo.selector.close",size:"wide",height:"auto",headerLayout:"document",headerTone:"accent",headerPalette:"green",headerTitleTone:"neutral",bodyLayout:"flush",headerControls:e,onClose:()=>this.requestClose(),onMenuSelect:l=>this.onPopupMenuSelect(l)}}requestUserSelect(e){if(!(this.loading||this.submitting)){if(this.contextRequest){this.selectContextUser(e);return}this.userSelected.emit(e);}}requestRetry(){if(!(this.loading||this.submitting)){if(this.contextRequest){this.openContextRequest(this.contextRequest);return}this.retryRequested.emit();}}userStatusClass(e){switch(`${e.status??""}`.trim().toUpperCase()){case "B":return "demo-user-item-blocked";case "D":return "demo-user-item-deleted";default:return this.isNewProfile(e)?"demo-user-item-new":e.locationRequired?"demo-user-item-location":""}}userStatusLabel(e){switch(`${e.status??""}`.trim().toUpperCase()){case "B":return "demo.selector.status.blocked";case "D":return "demo.selector.status.deleted";default:return this.isNewProfile(e)?"demo.selector.status.new":e.locationRequired?"demo.selector.status.location":""}}userGenderLabel(e){return e.gender==="woman"?"woman":"man"}userAvatarClass(e){return this.isNewProfile(e)?"user-color-setup":`user-color-${e.gender}`}userAvatarLabel(e){return this.isNewProfile(e)?"":`${e.initials??""}`.trim()}userAvatarUrl(e){return this.isNewProfile(e)?"":f$1.mediaImageVariantUrl(e.avatarUrl,"small")}isNewProfile(e){return c.isEmptyOnboardingProfile(e)}newProfileMenuItems(){return this.newProfileAvailable()?[{id:"new-profile",label:"new.demo.profile",icon:"person_add",kind:"action",layout:"action",compactOnMobile:true,palette:"red",disabled:()=>this.loading||this.submitting,ariaLabel:"demo.profile.create.aria",context:{action:"new-profile"}}]:[]}selectorRoleMenuTrigger(){return {label:this.selectorRoleLabel(this.selectedMode),icon:this.selectorRoleIcon(this.selectedMode),trailingIcon:"expand_more",ariaLabel:"demo.selector.filter.aria",palette:this.selectorRolePalette(this.selectedMode),layout:"pill",disabled:()=>this.submitting}}selectorRoleMenuItems(){let e=this.contextRequest?.selectableModes??[this.selectedMode];return e.length<=1?[]:e.map(t=>({id:t,label:this.selectorRoleLabel(t),icon:this.selectorRoleIcon(t),kind:"radio",palette:this.selectorRolePalette(t),surface:"tinted",active:()=>this.selectedMode===t,disabled:()=>this.submitting,ariaLabel:this.i18n.translateParams("demo.selector.role.show.aria",{role:this.selectorRoleLabel(t)}),context:{mode:t}}))}onPopupMenuSelect(e){if(e.control.id==="new-profile"){e.itemSelect.context&&"action"in e.itemSelect.context&&this.requestNewProfile();return}let t=e.itemSelect.context,o=t&&"mode"in t?t.mode:e.itemSelect.id;this.selectContextMode(o);}visibleUsers(){let e=this.contextRequest?.groupType;return this.users.filter(t=>!this.isNewProfile(t)&&(!e||this.selectedMode==="operator"||t.baseGroupTypes?.includes(e)))}selectedUser(){let e=this.selectedUserId.trim();return e?this.users.find(t=>t.id.trim()===e)??null:null}loadingPosition(){let e=Number(this.loadingProgress);return Number.isFinite(e)?Math.max(0,Math.min(1,e/100)):0}userListLoadDurationMs(){return 3e3}openContextRequest(e){let t=++this.contextRequestToken;this.contextRequest=e,this.contextControlled=true,this.contextSelectorSeedReady=false,this.commit(()=>{this.open=true,this.title=e.title??"select.demo.user",this.subtitle=e.subtitle??"demo.selector.subtitle",this.selectedMode=e.mode,this.users=e.users?.map(o=>r$1({},o))??[],this.loading=true,this.loadingUserList=false,this.loadingProgress=0,this.loadingLabel="demo.bootstrap.loading",this.loadingStage="selector",this.errorMessage="",this.submitting=false,this.selectedUserId="";}),this.loadContextUsers(e,t,e.mode,true);}async loadContextUsers(e,t,o,l){if(await this.waitForPopupPaint(),!!this.isCurrentContextRequest(t))try{if(this.usersService.localModeEnabled&&!this.contextSelectorSeedReady){let S=await this.localSeedBootstrap();l?await S.ensureDemoSelectorReady(this.selectorSeedMode(e),v=>{this.isCurrentContextRequest(t)&&this.commit(()=>{this.loadingUserList=!1,this.loadingProgress=v.percent,this.loadingLabel=v.label,this.loadingStage=v.stage;});}):(this.commit(()=>{this.loadingUserList=!0,this.loadingProgress=0,this.loadingLabel=this.i18n.translateParams("demo.users.loading",{role:this.selectorRoleLabel(o).toLowerCase()}),this.loadingStage="users";}),await S.ensureDemoSelectorReady(this.selectorSeedMode(e))),this.contextSelectorSeedReady=!0,l&&await this.waitForPhaseReadyBlink();}if(!this.isCurrentContextRequest(t))return;let c=o===e.mode?e.users?.map(S=>r$1({},S))??null:null;if(c||(this.commit(()=>{this.loadingUserList=!0,this.loadingProgress=0,this.loadingLabel=this.i18n.translateParams("demo.users.loading",{role:this.selectorRoleLabel(o).toLowerCase()}),this.loadingStage="users";}),c=await this.usersService.loadAvailableDemoUsers(o)),!this.isCurrentContextRequest(t))return;this.commit(()=>{this.users=c,this.errorMessage="",this.loadingUserList=!1,this.selectedMode=o;});let b=`${e.autoSelectUserId??""}`.trim();if(b&&o===e.mode){if(!(c.find(v=>v.id.trim()===b)??null)){this.commit(()=>{this.loading=!1,this.loadingUserList=!1,this.loadingProgress=0,this.loadingLabel="demo.selector.retry",this.loadingStage="selector",this.errorMessage="demo.session.open.error";});return}this.selectContextUser(b);return}this.commit(()=>{this.loading=!1;});}catch{if(!this.isCurrentContextRequest(t))return;this.commit(()=>{this.loading=false,this.loadingUserList=false,this.loadingProgress=0,this.loadingLabel="demo.selector.retry",this.loadingStage="selector",this.errorMessage="demo.selector.load.error";});}}selectContextUser(e){if(!this.contextRequest)return;let t=e.trim();if(!t)return;let o=this.contextRequestToken;if(!this.usersService.localModeEnabled){this.commit(()=>{this.submitting=true,this.selectedUserId=t,this.errorMessage="";}),this.completeContextSelection(t,this.selectedMode,o);return}this.commit(()=>{this.submitting=true,this.selectedUserId=t,this.loading=true,this.loadingUserList=false,this.loadingProgress=0,this.loadingLabel="demo.session.preparing",this.loadingStage="session",this.errorMessage="";}),this.prepareContextUser(t,this.selectedMode,o);}selectContextMode(e){if(!this.contextRequest)return;let t=e==="admin"||e==="operator"?e:"member";if(t===this.selectedMode||this.submitting||!this.contextRequest.selectableModes.includes(t))return;let o=this.contextRequest,l=++this.contextRequestToken;this.commit(()=>{this.selectedMode=t,this.users=[],this.selectedUserId="",this.loading=true,this.loadingUserList=true,this.loadingProgress=0,this.loadingLabel=this.i18n.translateParams("demo.users.loading",{role:this.selectorRoleLabel(t).toLowerCase()}),this.loadingStage="users",this.errorMessage="";}),this.loadContextUsers(o,l,t,false);}requestNewProfile(){if(!(this.loading||this.submitting)){if(this.contextRequest){this.selectContextNewProfile();return}this.newProfileRequested.emit();}}selectContextNewProfile(){if(!this.contextRequest?.onNewProfile)return;let e=this.contextRequestToken;this.commit(()=>{this.submitting=true,this.selectedUserId="",this.loading=false,this.loadingUserList=false,this.loadingProgress=0,this.loadingLabel="Opening profile setup",this.loadingStage="session",this.errorMessage="";}),this.completeContextNewProfileSelection(e);}async prepareContextUser(e,t,o){if(await this.waitForPopupPaint(),!(!this.isCurrentContextRequest(o)||!this.contextRequest))try{let l=c=>{this.isCurrentContextRequest(o)&&this.commit(()=>{this.loadingProgress=c.percent,this.loadingLabel=c.label,this.loadingStage=c.stage;});};if(this.usersService.localModeEnabled?await(await this.localSeedBootstrap()).ensureUserReady(e,t,l):await this.usersService.prepareDemoUserSession(e,l),!this.isCurrentContextRequest(o)||(this.commit(()=>{this.loadingProgress=100,this.loadingLabel="demo.session.ready.title",this.loadingStage="sessionReady";}),await this.waitForLoaderCompletionBeat(),!this.isCurrentContextRequest(o)))return;await this.completeContextSelection(e,t,o);}catch{this.isCurrentContextRequest(o)&&this.resetContextSelectionFailure("Unable to open demo session.");}}async localSeedBootstrap(){let{SeedDemoBootstrapService:e}=await import('./chunk-b0e20113.js');return this.injector.get(e)}async completeContextSelection(e,t,o){let l=this.contextRequest;if(!(!l||!this.isCurrentContextRequest(o)))try{let c=await l.onSelect(e,t,this.users.find(b=>b.id===e));if(!this.isCurrentContextRequest(o)||c!==!1&&typeof c!="string")return;this.resetContextSelectionFailure(typeof c=="string"?c.trim():"demo.session.open.error");}catch{this.isCurrentContextRequest(o)&&this.resetContextSelectionFailure("demo.session.open.error");}}async completeContextNewProfileSelection(e){let t=this.contextRequest;if(!(!t?.onNewProfile||!this.isCurrentContextRequest(e)))try{if(await t.onNewProfile(),!this.isCurrentContextRequest(e))return;this.commit(()=>{this.submitting=!1;});}catch{this.isCurrentContextRequest(e)&&this.resetContextSelectionFailure("Unable to open profile setup.");}}newProfileAvailable(){return this.contextRequest?this.selectedMode==="member"&&!!this.contextRequest.onNewProfile:true}selectorSeedMode(e){return e.selectableModes.length>1?"union":e.mode}selectorRoleLabel(e){return e==="admin"?this.i18n.translate("admin.role.label"):e==="operator"?this.i18n.translate("operator"):this.i18n.translate("member")}selectorRoleIcon(e){return e==="admin"?"admin_panel_settings":e==="operator"?"dns":"person"}selectorRolePalette(e){return e==="admin"?"blue":e==="operator"?"violet":"green"}resetContextSelectionFailure(e){this.commit(()=>{this.loading=false,this.loadingUserList=false,this.submitting=false,this.selectedUserId="",this.loadingProgress=0,this.loadingLabel="demo.bootstrap.loading",this.loadingStage="selector",this.errorMessage=e;});}isCurrentContextRequest(e){return this.open&&this.contextRequestToken===e&&this.contextRequest!==null}resetContextState(){this.contextControlled&&(this.contextRequestToken+=1,this.contextRequest=null,this.contextControlled=false,this.contextSelectorSeedReady=false,this.open=false,this.loading=false,this.loadingUserList=false,this.loadingProgress=0,this.loadingLabel="demo.bootstrap.loading",this.loadingStage="selector",this.errorMessage="",this.submitting=false,this.selectedUserId="",this.users=[],this.selectedMode="member",this.changeDetectorRef.markForCheck());}commit(e){this.ngZone.run(()=>{e(),this.changeDetectorRef.detectChanges();});}waitForPopupPaint(){return new Promise(e=>{if(typeof window<"u"&&typeof window.requestAnimationFrame=="function"){window.requestAnimationFrame(()=>{window.requestAnimationFrame(()=>{setTimeout(e,80);});});return}setTimeout(e,80);})}waitForLoaderCompletionBeat(){return new Promise(e=>setTimeout(e,240))}waitForPhaseReadyBlink(){return new Promise(e=>setTimeout(e,500))}static \u0275fac=function(t){return new(t||i)};static \u0275cmp=ID({type:i,selectors:[["app-demo-bootstrap-selector"]],hostBindings:function(t,o){t&1&&Fh("keydown.escape",function(c){return o.onGlobalEscape(c)},sE);},inputs:{open:"open",loading:"loading",loadingProgress:"loadingProgress",loadingLabel:"loadingLabel",loadingStage:"loadingStage",errorMessage:"errorMessage",submitting:"submitting",users:"users",title:"title",subtitle:"subtitle",selectedUserId:"selectedUserId"},outputs:{closeRequested:"closeRequested",retryRequested:"retryRequested",userSelected:"userSelected",newProfileRequested:"newProfileRequested"},decls:1,vars:1,consts:[[3,"model","zIndex"],["appLandingGuideSurface","landing.demo",1,"demo-user-stage"],[1,"demo-user-grid","demo-user-grid-loading"],[1,"demo-user-loading-shell"],[1,"demo-user-loading-copy-group"],[1,"demo-user-loading-eyebrow"],[1,"demo-user-selected-session"],[1,"demo-user-loading-copy"],["role","progressbar",1,"demo-user-progress-shell"],["kind","load-ring","state","loading",3,"durationMs"],["kind","pill-bar",3,"position"],[1,"demo-user-progress-value"],[1,"demo-user-selected-avatar-wrap"],[1,"demo-user-selected-copy"],["aria-hidden","true",1,"demo-user-selected-ring"],["data-i18n-ignore","",1,"user-avatar",3,"ngClass"],["alt","","loading","lazy","decoding","async",3,"src"],["alt","","loading","lazy","decoding","async",3,"load","error","src"],[1,"demo-user-grid"],["mat-flat-button","","type","button",1,"demo-user-retry-btn",3,"click","disabled"],["type","button","data-guide-field","member-card","matRipple","",1,"demo-user-item",3,"ngClass","demo-user-item-selected","disabled","matRippleColor"],["type","button","data-guide-field","member-card","matRipple","",1,"demo-user-item",3,"click","ngClass","disabled","matRippleColor"],["data-i18n-ignore","",1,"user-avatar",3,"has-photo","ngClass"],["data-i18n-ignore","",1,"demo-user-name"],[1,"demo-user-name"],[1,"demo-user-meta"],[1,"demo-user-status-pill"],["aria-hidden","true",1,"demo-user-meta-separator"],["data-i18n-ignore","",1,"demo-user-city"],[1,"demo-user-city"]],template:function(t,o){t&1&&uT(0,we,4,3,"app-popup",0),t&2&&dT(o.open?0:-1);},dependencies:[m,Gt,bn,it,rt,Be,Ue,lf,On,si],styles:['[_nghost-%COMP%]{display:contents;font-family:var(--entry-font-family, "Nunito Sans", "Segoe UI", sans-serif)}.demo-user-stage[_ngcontent-%COMP%]{position:relative;min-height:0;height:clamp(22rem,62vh,31rem)}.demo-user-grid[_ngcontent-%COMP%]{box-sizing:border-box;height:100%;padding:.92rem 1rem 1rem;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-content:start;gap:.45rem;overflow-y:auto;overflow-x:hidden;min-height:0}.demo-user-grid-loading[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr);align-content:stretch;place-items:center;min-height:0;overflow:hidden}.demo-user-loading-copy[_ngcontent-%COMP%]{margin:0;color:var(--entry-text-muted, rgba(34, 50, 74, .72));font-size:.88rem;font-weight:600;text-align:center}.demo-user-loading-shell[_ngcontent-%COMP%]{width:100%;height:100%;display:grid;place-items:center;padding:1.2rem;box-sizing:border-box}.demo-user-loading-copy-group[_ngcontent-%COMP%]{width:min(100%,32rem);display:grid;gap:.75rem;justify-items:center;text-align:center}.demo-user-loading-eyebrow[_ngcontent-%COMP%]{margin:0;color:#2c5796c7;font-size:.74rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.demo-user-progress-shell[_ngcontent-%COMP%]{width:min(100%,23rem)}.demo-user-progress-value[_ngcontent-%COMP%]{margin:0;color:#1b3254d1;font-size:.8rem;font-weight:800}.demo-user-selected-session[_ngcontent-%COMP%]{display:inline-flex;align-items:center;gap:.62rem;min-width:min(100%,17rem);padding:.44rem .68rem .44rem .48rem;border:1px solid rgba(66,107,174,.22);border-radius:999px;background:linear-gradient(180deg,#fff,#f4f8ff);box-shadow:0 10px 22px #1428481a}.demo-user-selected-avatar-wrap[_ngcontent-%COMP%]{position:relative;width:44px;height:44px;display:inline-grid;place-items:center;flex:0 0 auto}.demo-user-selected-avatar-wrap[_ngcontent-%COMP%]   .user-avatar[_ngcontent-%COMP%]{width:36px;height:36px;font-size:.84rem;position:relative;z-index:1}.demo-user-selected-ring[_ngcontent-%COMP%]{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(66,116,202,.16);border-top-color:#4274cad1;animation:_ngcontent-%COMP%_demo-user-selected-ring-spin .9s linear infinite}.demo-user-selected-copy[_ngcontent-%COMP%]{display:grid;gap:.06rem;text-align:left}.demo-user-selected-copy[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%]{color:var(--entry-text-main, #22324a);font-size:.88rem;line-height:1.1}.demo-user-selected-copy[_ngcontent-%COMP%]   small[_ngcontent-%COMP%]{color:#2c5796c7;font-size:.72rem;font-weight:800;line-height:1.1}.demo-user-retry-btn[_ngcontent-%COMP%]{min-width:8.5rem;border-radius:999px}.demo-user-item[_ngcontent-%COMP%]{position:relative;overflow:hidden;height:5rem;border:1px solid var(--entry-line, rgba(23, 33, 54, .12));border-radius:12px;background:#fff;padding:.55rem;cursor:pointer;display:grid;grid-template-columns:38px minmax(0,1fr);grid-template-rows:auto auto;column-gap:.58rem;row-gap:.08rem;align-content:center;align-items:center;text-align:left;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}.demo-user-item[_ngcontent-%COMP%]:hover{transform:translateY(-1px);box-shadow:0 10px 18px #0d1b3914}.demo-user-item[_ngcontent-%COMP%]:disabled{cursor:default}.demo-user-item-selected[_ngcontent-%COMP%]{border-color:#3f70cb7a;background:linear-gradient(180deg,#f9fbff,#edf4ff);box-shadow:inset 3px 0 #3f70cbd9}.demo-user-item.demo-user-item-blocked[_ngcontent-%COMP%]{border-color:#b53b4859;background:linear-gradient(180deg,#fff6f6,#fde9e9)}.demo-user-item.demo-user-item-deleted[_ngcontent-%COMP%]{border-color:#61697657;background:linear-gradient(180deg,#f7f8fa,#e9edf2)}.demo-user-item.demo-user-item-new[_ngcontent-%COMP%]{border-color:#26826161;background:linear-gradient(180deg,#f7fffb,#e8f8ef)}.demo-user-item.demo-user-item-location[_ngcontent-%COMP%]{border-color:#b5741c59;background:linear-gradient(180deg,#fffcf6,#fff1d9)}.demo-user-item[_ngcontent-%COMP%]   .user-avatar[_ngcontent-%COMP%], .demo-user-item[_ngcontent-%COMP%]   .demo-user-name[_ngcontent-%COMP%], .demo-user-item[_ngcontent-%COMP%]   .demo-user-meta[_ngcontent-%COMP%]{position:relative;z-index:1}.demo-user-item[_ngcontent-%COMP%]   .user-avatar[_ngcontent-%COMP%]{grid-column:1;grid-row:1/span 2;align-self:center}.demo-user-item[_ngcontent-%COMP%]   .demo-user-name[_ngcontent-%COMP%]{grid-column:2;grid-row:1;align-self:end;min-width:0}.demo-user-item[_ngcontent-%COMP%]   .demo-user-meta[_ngcontent-%COMP%]{grid-column:2;grid-row:2;align-self:start;min-width:0}.user-avatar[_ngcontent-%COMP%]{width:38px;height:38px;flex:0 0 38px;border-radius:50%;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;color:#fff;font-size:.9rem;font-weight:800}.user-avatar.has-photo[_ngcontent-%COMP%]{background:#eef3f9}.user-avatar[_ngcontent-%COMP%]   img[_ngcontent-%COMP%]{opacity:0;display:block;width:100%;height:100%;object-fit:cover;object-position:center}.user-avatar[_ngcontent-%COMP%]   img.is-loaded[_ngcontent-%COMP%]{opacity:1}.user-avatar.user-color-woman[_ngcontent-%COMP%]{background:linear-gradient(180deg,#ff87b7,#ec4b93)}.user-avatar.user-color-man[_ngcontent-%COMP%]{background:linear-gradient(180deg,#74a2ff,#3968d8)}.user-avatar.user-color-setup[_ngcontent-%COMP%]{background:linear-gradient(180deg,#78d4b8,#2a8f73)}.demo-user-name[_ngcontent-%COMP%]{font-size:.86rem;font-weight:700;color:var(--entry-text-main, #22324a)}.demo-user-meta[_ngcontent-%COMP%]{font-size:.74rem;color:var(--entry-text-muted, rgba(34, 50, 74, .72))}.demo-user-status-pill[_ngcontent-%COMP%]{position:absolute;top:.48rem;right:.5rem;z-index:1;padding:.16rem .44rem;border-radius:999px;font-size:.66rem;font-weight:800;text-transform:uppercase;letter-spacing:0}.demo-user-item-blocked[_ngcontent-%COMP%]   .demo-user-status-pill[_ngcontent-%COMP%]{background:#b53b48;color:#fff}.demo-user-item-deleted[_ngcontent-%COMP%]   .demo-user-status-pill[_ngcontent-%COMP%]{background:#657080;color:#fff}.demo-user-item-new[_ngcontent-%COMP%]   .demo-user-status-pill[_ngcontent-%COMP%]{background:#268261;color:#fff}.demo-user-item-location[_ngcontent-%COMP%]   .demo-user-status-pill[_ngcontent-%COMP%]{background:#9b6014;color:#fff}@media(max-width:760px){.demo-user-stage[_ngcontent-%COMP%]{height:100%}.demo-user-grid[_ngcontent-%COMP%]{grid-template-columns:repeat(2,minmax(0,1fr));padding-bottom:calc(1rem + env(safe-area-inset-bottom))}.demo-user-grid-loading[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr);justify-items:center;align-items:center}.demo-user-loading-shell[_ngcontent-%COMP%]{padding:max(1.2rem,env(safe-area-inset-top)) 1.4rem max(1.2rem + env(safe-area-inset-bottom),1.2rem)}.demo-user-loading-copy-group[_ngcontent-%COMP%]{width:min(100%,24rem)}.demo-user-progress-shell[_ngcontent-%COMP%]{width:min(100%,18.5rem);margin-inline:auto}}@keyframes _ngcontent-%COMP%_demo-user-selected-ring-spin{to{transform:rotate(360deg)}}']})};var chunkXAJ5QXFD=/*#__PURE__*/Object.freeze({__proto__:null,DemoBootstrapSelectorComponent:te$1});function J(p,o){if(p&1&&(zi(0,"p",6),rw(1),bw(2,"i18n"),_l()),p&2){let e=_T(2);wE(),eg(Mw(2,1,e.statusMessage));}}function K(p,o){if(p&1){let e=DT();zi(0,"div",7)(1,"button",8),Fh("click",function(){ld(e);let r=_T(2);return ud(r.requestProvider("google"))}),zi(2,"span",9)(3,"span",10),rw(4,"G"),_l()(),zi(5,"span"),rw(6),bw(7,"i18n"),_l()(),zi(8,"button",11),bw(9,"i18n"),zi(10,"span",12),rw(11,"f"),_l(),zi(12,"span"),rw(13),bw(14,"i18n"),_l(),zi(15,"span",13),rw(16),bw(17,"i18n"),_l()(),zi(18,"button",14),Fh("click",function(){ld(e);let r=_T(2);return ud(r.openEmail())}),zi(19,"span",15)(20,"mat-icon"),rw(21,"mail"),_l()(),zi(22,"span"),rw(23),bw(24,"i18n"),_l()(),zi(25,"p",16),rw(26),bw(27,"i18n"),zi(28,"a",17),rw(29,"Google"),_l(),rw(30),bw(31,"i18n"),zi(32,"a",17),rw(33,"Meta/Facebook"),_l(),rw(34),bw(35,"i18n"),_l()();}if(p&2){let e=_T(2);wE(),xh("disabled",e.busy)("matRippleColor","rgba(66, 133, 244, 0.12)"),wE(5),eg(Mw(7,14,e.busy?"connecting":"continue.with.google")),wE(2),Nh("title",Mw(9,16,"facebook.login.coming.soon")),wE(5),eg(Mw(14,18,"continue.with.facebook")),wE(3),eg(Mw(17,20,"coming.soon")),wE(2),xh("disabled",e.busy)("matRippleColor","rgba(54, 74, 104, 0.12)"),wE(5),eg(Mw(24,22,"continue.with.email")),wE(3),Al(" ",Mw(27,24,"firebase.auth.provider.terms.prefix")," "),wE(2),xh("href",e.googleTermsUrl,nE),wE(2),Al(" ",Mw(31,26,"and")," "),wE(2),xh("href",e.facebookTermsUrl,nE),wE(2),Al(" ",Mw(35,28,"firebase.auth.provider.terms.suffix")," ");}}function Q(p,o){if(p&1&&Sh(0,"span"),p&2){let e=o.$implicit,m=_T(3);zh("active",e<=m.passwordStrengthLevel());}}function X(p,o){if(p&1&&(zi(0,"ul",29),bw(1,"i18n"),zi(2,"li")(3,"mat-icon"),rw(4),_l(),zi(5,"span"),rw(6),bw(7,"i18n"),_l()(),zi(8,"li")(9,"mat-icon"),rw(10),_l(),zi(11,"span"),rw(12),bw(13,"i18n"),_l()(),zi(14,"li")(15,"mat-icon"),rw(16),_l(),zi(17,"span"),rw(18),bw(19,"i18n"),_l()(),zi(20,"li")(21,"mat-icon"),rw(22),_l(),zi(23,"span"),rw(24),bw(25,"i18n"),_l()(),zi(26,"li")(27,"mat-icon"),rw(28),_l(),zi(29,"span"),rw(30),bw(31,"i18n"),_l()()()),p&2){let e=_T(3);Nh("aria-label",Mw(1,21,"password.rules")),wE(2),zh("met",e.passwordHasMinimumLength()),wE(2),eg(e.passwordHasMinimumLength()?"check_circle":"radio_button_unchecked"),wE(2),eg(Mw(7,23,"password.minimum.8")),wE(2),zh("met",e.passwordHasLetter()),wE(2),eg(e.passwordHasLetter()?"check_circle":"radio_button_unchecked"),wE(2),eg(Mw(13,25,"password.letter")),wE(2),zh("met",e.passwordHasNumber()),wE(2),eg(e.passwordHasNumber()?"check_circle":"radio_button_unchecked"),wE(2),eg(Mw(19,27,"password.number")),wE(2),zh("met",e.passwordHasOptionalSymbol()),wE(2),eg(e.passwordHasOptionalSymbol()?"check_circle":"radio_button_unchecked"),wE(2),eg(Mw(25,29,"password.symbol.optional")),wE(2),zh("met",e.passwordConfirmationMatches()),wE(2),eg(e.passwordConfirmationMatches()?"check_circle":"radio_button_unchecked"),wE(2),eg(Mw(31,31,"passwords.match"));}}function $(p,o){if(p&1){let e=DT();zi(0,"label")(1,"span"),rw(2),bw(3,"i18n"),_l(),zi(4,"span",23)(5,"input",32),ig("ngModelChange",function(r){ld(e);let _=_T(3);return cw(_.passwordConfirmation,r)||(_.passwordConfirmation=r),ud(r)}),_l(),zi(6,"button",25),bw(7,"i18n"),Fh("click",function(){ld(e);let r=_T(3);return ud(r.togglePasswordConfirmationVisibility())}),zi(8,"mat-icon"),rw(9),_l()()()();}if(p&2){let e=_T(3);wE(2),eg(Mw(3,7,"confirm.password")),wE(3),xh("type",e.passwordConfirmationInputType())("disabled",e.busy),og("ngModel",e.passwordConfirmation),wE(),xh("disabled",e.busy),Nh("aria-label",Mw(7,9,e.passwordConfirmationVisible?"hide.password":"show.password")),wE(3),eg(e.passwordConfirmationVisible?"visibility_off":"visibility");}}function ee(p,o){if(p&1&&(zi(0,"p",30),rw(1),bw(2,"i18n"),_l()),p&2){let e=_T(3);wE(),eg(Mw(2,1,e.emailError));}}function te(p,o){if(p&1){let e=DT();zi(0,"button",18),Fh("click",function(){ld(e);let r=_T(2);return ud(r.backToProviders())}),zi(1,"mat-icon"),rw(2,"arrow_back"),_l(),zi(3,"span"),rw(4),bw(5,"i18n"),_l()(),zi(6,"form",19),Fh("submit",function(r){ld(e);let _=_T(2);return r.preventDefault(),ud(_.requestEmail())}),zi(7,"div",20),bw(8,"i18n"),zi(9,"button",21),Fh("click",function(){ld(e);let r=_T(2);return ud(r.setEmailMode("sign-in"))}),rw(10),bw(11,"i18n"),_l(),zi(12,"button",21),Fh("click",function(){ld(e);let r=_T(2);return ud(r.setEmailMode("create"))}),rw(13),bw(14,"i18n"),_l()(),zi(15,"label")(16,"span"),rw(17),bw(18,"i18n"),_l(),zi(19,"input",22),ig("ngModelChange",function(r){ld(e);let _=_T(2);return cw(_.email,r)||(_.email=r),ud(r)}),_l()(),zi(20,"label")(21,"span"),rw(22),bw(23,"i18n"),_l(),zi(24,"span",23)(25,"input",24),bw(26,"i18n"),ig("ngModelChange",function(r){ld(e);let _=_T(2);return cw(_.password,r)||(_.password=r),ud(r)}),_l(),zi(27,"button",25),bw(28,"i18n"),Fh("click",function(){ld(e);let r=_T(2);return ud(r.togglePasswordVisibility())}),zi(29,"mat-icon"),rw(30),_l()()()(),zi(31,"div",26),bw(32,"i18n"),zi(33,"div",27),hT(34,Q,1,2,"span",28,pT),_l(),zi(36,"span"),rw(37),bw(38,"i18n"),_l()(),uT(39,X,32,33,"ul",29),uT(40,$,10,11,"label"),uT(41,ee,3,3,"p",30),zi(42,"button",31)(43,"mat-icon"),rw(44,"mail"),_l(),zi(45,"span"),rw(46),bw(47,"i18n"),_l()()();}if(p&2){let e=_T(2);xh("disabled",e.busy),wE(4),eg(Mw(5,41,"all.login.methods")),wE(3),Nh("aria-label",Mw(8,43,"email.login.mode")),wE(2),zh("active",e.emailMode==="sign-in"),xh("disabled",e.busy),Nh("aria-selected",e.emailMode==="sign-in"),wE(),Al(" ",Mw(11,45,"login")," "),wE(2),zh("active",e.emailMode==="create"),xh("disabled",e.busy),Nh("aria-selected",e.emailMode==="create"),wE(),Al(" ",Mw(14,47,"create")," "),wE(4),eg(Mw(18,49,"email")),wE(2),xh("disabled",e.busy),og("ngModel",e.email),wE(3),eg(Mw(23,51,"password")),wE(3),xh("type",e.passwordInputType())("autocomplete",e.emailPasswordAutocomplete())("placeholder",Mw(26,53,e.passwordPlaceholder()))("disabled",e.busy),og("ngModel",e.password),wE(2),xh("disabled",e.busy),Nh("aria-label",Mw(28,55,e.passwordVisible?"hide.password":"show.password")),wE(3),eg(e.passwordVisible?"visibility_off":"visibility"),wE(),zh("level-1",e.passwordStrengthLevel()===1)("level-2",e.passwordStrengthLevel()===2)("level-3",e.passwordStrengthLevel()===3)("level-4",e.passwordStrengthLevel()===4),Nh("aria-label",Mw(32,57,e.passwordStrengthText())),wE(3),gT(e.passwordStrengthSegments()),wE(3),eg(Mw(38,59,e.passwordStrengthText())),wE(2),dT(e.emailMode==="create"?39:-1),wE(),dT(e.emailMode==="create"?40:-1),wE(),dT(e.emailError?41:-1),wE(),xh("disabled",e.busy)("matRippleColor","rgba(255, 255, 255, 0.22)"),wE(4),eg(Mw(47,61,e.emailSubmitLabel()));}}function ie(p,o){if(p&1){let e=DT();zi(0,"section",0)(1,"div",1),Fh("click",function(){ld(e);let r=_T();return ud(r.requestClose())}),_l(),zi(2,"div",2),Fh("click",function(r){return r.stopPropagation()}),zi(3,"div",3)(4,"h2"),rw(5),bw(6,"i18n"),_l(),zi(7,"button",4),bw(8,"i18n"),Fh("click",function(){ld(e);let r=_T();return ud(r.requestClose())}),zi(9,"mat-icon",5),rw(10,"close"),_l()()(),uT(11,J,3,3,"p",6),uT(12,K,36,30,"div",7)(13,te,48,63),_l()();}if(p&2){let e=_T();wE(2),zh("mobile-fullscreen",e.isMobileView),wE(3),eg(Mw(6,7,"login")),wE(2),xh("matRippleColor","rgba(41, 78, 128, 0.12)"),Nh("aria-label",Mw(8,9,"close.login.popup")),wE(4),dT(e.statusMessage?11:-1),wE(),dT(e.authStep==="providers"?12:13);}}var Z=class p{open=false;busy=false;isMobileView=false;statusMessage="";closeRequested=new Qe;authRequested=new Qe;authStep="providers";emailMode="sign-in";email="";password="";passwordConfirmation="";passwordVisible=false;passwordConfirmationVisible=false;emailError="";googleTermsUrl="https://policies.google.com/terms";facebookTermsUrl="https://www.facebook.com/legal/terms";requestClose(){this.closeRequested.emit();}requestProvider(o){this.emailError="",this.authRequested.emit({provider:o});}openEmail(){this.busy||(this.authStep="email",this.emailMode="sign-in",this.emailError="");}backToProviders(){this.busy||(this.authStep="providers",this.emailError="");}togglePasswordVisibility(){this.passwordVisible=!this.passwordVisible;}togglePasswordConfirmationVisibility(){this.passwordConfirmationVisible=!this.passwordConfirmationVisible;}setEmailMode(o){this.busy||(this.emailMode=o,this.emailError="",o==="sign-in"&&(this.passwordConfirmation=""));}requestEmail(){if(this.busy)return;let o=this.email.trim();if(!this.isValidEmail(o)){this.emailError="firebase.auth.error.email.invalid";return}if(this.emailMode==="sign-in"&&this.password.length<6){this.emailError="firebase.auth.error.password.minimum";return}if(this.emailMode==="create"&&!this.isCreatePasswordValid()){this.emailError="firebase.auth.error.password.rules";return}if(this.emailMode==="create"&&this.password!==this.passwordConfirmation){this.emailError="firebase.auth.error.password.mismatch";return}this.emailError="",this.authRequested.emit({provider:"email",emailMode:this.emailMode,email:o,password:this.password});}emailSubmitLabel(){return this.busy?"connecting":this.emailMode==="create"?"create.account":"login"}emailPasswordAutocomplete(){return this.emailMode==="create"?"new-password":"current-password"}passwordPlaceholder(){return this.emailMode==="create"?"firebase.auth.password.create.placeholder":"password"}passwordInputType(){return this.passwordVisible?"text":"password"}passwordConfirmationInputType(){return this.passwordConfirmationVisible?"text":"password"}passwordStrengthLevel(){let o=this.password;if(!o)return 0;let e=[o.length>=8,o.length>=12,/[a-z]/.test(o)&&/[A-Z]/.test(o),/\d/.test(o),/[^A-Za-z0-9]/.test(o)];return Math.min(4,Math.max(1,e.filter(Boolean).length))}passwordStrengthSegments(){return [1,2,3,4]}passwordStrengthText(){switch(this.passwordStrengthLevel()){case 1:return "password.strength.weak";case 2:return "password.strength.basic";case 3:return "good";case 4:return "password.strength.strong";default:return "password.strength"}}passwordHasMinimumLength(){return this.password.length>=8}passwordHasLetter(){return this.hasTextLetter(this.password)}passwordHasNumber(){return /\d/.test(this.password)}passwordHasOptionalSymbol(){return Array.from(this.password).some(o=>!this.isTextLetter(o)&&!/\d/.test(o))}passwordConfirmationMatches(){return this.password.length>0&&this.password===this.passwordConfirmation}isCreatePasswordValid(){return this.passwordHasMinimumLength()&&this.passwordHasLetter()&&this.passwordHasNumber()}hasTextLetter(o){return Array.from(o).some(e=>this.isTextLetter(e))}isTextLetter(o){return o.toLocaleLowerCase("en-US")!==o.toLocaleUpperCase("en-US")}isValidEmail(o){return f$1.isEmail(o)}static \u0275fac=function(e){return new(e||p)};static \u0275cmp=ID({type:p,selectors:[["app-entry-firebase-auth-popup"]],inputs:{open:"open",busy:"busy",isMobileView:"isMobileView",statusMessage:"statusMessage"},outputs:{closeRequested:"closeRequested",authRequested:"authRequested"},decls:1,vars:1,consts:[[1,"firebase-auth-overlay"],[1,"firebase-auth-backdrop",3,"click"],["appLandingGuideSurface","landing.auth",1,"firebase-auth-panel",3,"click"],[1,"firebase-auth-header"],["type","button","matRipple","",1,"popup-close",3,"click","matRippleColor"],["aria-hidden","true"],["role","status",1,"firebase-auth-status"],["data-guide-field","providers",1,"firebase-auth-provider-list"],["type","button","matRipple","",1,"firebase-auth-provider-btn","google",3,"click","disabled","matRippleColor"],["aria-hidden","true",1,"firebase-auth-brand-mark","google-mark"],[1,"google-mark-letter"],["type","button","disabled","","aria-disabled","true",1,"firebase-auth-provider-btn","facebook","coming-soon"],["aria-hidden","true",1,"firebase-auth-brand-mark","facebook-mark"],[1,"firebase-auth-provider-badge"],["type","button","matRipple","",1,"firebase-auth-provider-btn","email",3,"click","disabled","matRippleColor"],["aria-hidden","true",1,"firebase-auth-brand-mark","email-mark"],[1,"firebase-auth-provider-terms"],["target","_blank","rel","noopener noreferrer",3,"href"],["type","button","data-motion","none",1,"firebase-auth-back-btn",3,"click","disabled"],[1,"firebase-auth-email-form",3,"submit"],["data-guide-field","account-mode","role","tablist",1,"firebase-auth-email-tabs"],["type","button","role","tab","data-motion","none",3,"click","disabled"],["type","email","name","email","data-guide-field","email","autocomplete","email",3,"ngModelChange","disabled","ngModel"],[1,"firebase-auth-password-control"],["name","password","data-guide-field","password",3,"ngModelChange","type","autocomplete","placeholder","disabled","ngModel"],["type","button","data-motion","none",1,"firebase-auth-password-toggle",3,"click","disabled"],[1,"firebase-password-strength"],["aria-hidden","true",1,"firebase-password-strength-lines"],[3,"active"],["data-guide-field","password-rules",1,"firebase-password-rules"],[1,"firebase-auth-error"],["type","submit","data-guide-field","submit","matRipple","",1,"firebase-auth-main-btn",3,"disabled","matRippleColor"],["name","passwordConfirmation","data-guide-field","confirmation","autocomplete","new-password",3,"ngModelChange","type","disabled","ngModel"]],template:function(e,m){e&1&&uT(0,ie,14,11,"section",0),e&2&&dT(m.open?0:-1);},dependencies:[m,mr,hr,Mt$1,cr,ur,Pn,On$1,Be,Ue,Wi,Gi,si],styles:['.popup-close[_ngcontent-%COMP%]{flex:0 0 auto;width:34px;height:34px;min-width:34px;min-height:34px;border:1px solid rgba(47,86,139,.2);border-radius:50%;background:#ffffffeb;color:#264369eb;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;line-height:0;box-sizing:border-box;box-shadow:0 8px 18px #253e5f1f;--mdc-icon-button-state-layer-size: 34px}.popup-close[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;font-size:21px;line-height:21px;margin:0}.popup-close[_ngcontent-%COMP%]:not(:disabled):not([aria-disabled=true]):hover{border-color:#2f568b52;background:#fff;color:#183254fa}.popup-close[_ngcontent-%COMP%]:not(:disabled):not([aria-disabled=true]):active{background:#eff5fcf5}.popup-close[_ngcontent-%COMP%]:focus-visible{outline:2px solid rgba(61,108,186,.35);outline-offset:1px}.popup-close[_ngcontent-%COMP%]:disabled, .popup-close[aria-disabled=true][_ngcontent-%COMP%]{opacity:.56;cursor:default}[_nghost-%COMP%]{display:block;font-family:var(--entry-font-family, "Nunito Sans", "Segoe UI", sans-serif);--interactive-hover-lift: 0px;--interactive-hover-scale: 1;--interactive-press-scale: 1}.firebase-auth-overlay[_ngcontent-%COMP%]{position:fixed;inset:0;z-index:2850;display:flex;align-items:center;justify-content:center;padding:1rem}.firebase-auth-backdrop[_ngcontent-%COMP%]{position:absolute;inset:0;background:#0b1527b8}.firebase-auth-panel[_ngcontent-%COMP%]{position:relative;z-index:1;width:min(480px,100vw - 1.2rem);border-radius:14px;background:#fff;padding:.88rem;display:flex;flex-direction:column;gap:.7rem}.firebase-auth-panel[_ngcontent-%COMP%], .firebase-auth-panel[_ngcontent-%COMP%]   *[_ngcontent-%COMP%]{box-sizing:border-box}.firebase-auth-header[_ngcontent-%COMP%]{display:flex;align-items:center;justify-content:space-between;gap:.5rem}.firebase-auth-header[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%]{margin:0;font-size:1.12rem;color:var(--entry-text-main, #22324a)}.firebase-auth-provider-list[_ngcontent-%COMP%]{display:flex;flex-direction:column;gap:.55rem}.firebase-auth-provider-btn[_ngcontent-%COMP%]{width:100%;min-height:44px;border:1px solid rgba(44,74,121,.18);border-radius:8px;background:#fff;color:#203454f5;font-size:.88rem;font-weight:800;display:inline-flex;align-items:center;justify-content:flex-start;gap:.62rem;padding:0 .78rem;cursor:pointer}.firebase-auth-provider-btn.google[_ngcontent-%COMP%]{border-color:#4285f457;background:#fff;color:#26374f}.firebase-auth-provider-btn.facebook[_ngcontent-%COMP%]{background:#1877f2;border-color:#1877f2;color:#fff}.firebase-auth-provider-btn.email[_ngcontent-%COMP%]{background:#f4f7fb;color:#27364d}.firebase-auth-provider-btn.coming-soon[_ngcontent-%COMP%]{background:#1877f21f;border-color:#1877f238;color:#1c457ec7;cursor:not-allowed}.firebase-auth-provider-btn[_ngcontent-%COMP%]:disabled, .firebase-auth-email-form[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]:disabled{opacity:.68;cursor:default}.firebase-auth-provider-btn.coming-soon[_ngcontent-%COMP%]:disabled{opacity:1;cursor:not-allowed}.firebase-auth-brand-mark[_ngcontent-%COMP%]{flex:0 0 auto;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:.95rem;font-weight:900;line-height:1}.google-mark[_ngcontent-%COMP%]{position:relative;overflow:hidden;background:conic-gradient(#4285f4 0 25%,#34a853 0 50%,#fbbc05 0 75%,#ea4335 0 100%);border:0;color:#4285f4}.google-mark[_ngcontent-%COMP%]:before{content:"";position:absolute;inset:3px;border-radius:inherit;background:#fff}.google-mark-letter[_ngcontent-%COMP%]{position:relative;z-index:1;font-size:.92rem;font-weight:950}.facebook-mark[_ngcontent-%COMP%]{background:#1877f2;color:#fff;font-family:Arial,sans-serif;font-size:1.2rem}.email-mark[_ngcontent-%COMP%]{background:#e5ebf4;color:#33445e}.email-mark[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{width:16px;height:16px;font-size:16px;line-height:16px}.firebase-auth-provider-badge[_ngcontent-%COMP%]{margin-left:auto;border-radius:999px;background:#ffffffb8;color:#174888e0;padding:.15rem .42rem;font-size:.66rem;font-weight:900;line-height:1;white-space:nowrap}.firebase-auth-provider-terms[_ngcontent-%COMP%]{margin:.12rem 0 0;color:#36435aad;font-size:.72rem;font-weight:750;line-height:1.35}.firebase-auth-provider-terms[_ngcontent-%COMP%]   a[_ngcontent-%COMP%]{color:#1c56a8f5;font-weight:900;text-decoration:none}.firebase-auth-provider-terms[_ngcontent-%COMP%]   a[_ngcontent-%COMP%]:hover{text-decoration:underline}.firebase-auth-divider[_ngcontent-%COMP%]{min-height:1px;display:flex;align-items:center;gap:.55rem;color:#22324a99;font-size:.74rem;font-weight:800;text-transform:uppercase}.firebase-auth-divider[_ngcontent-%COMP%]:before, .firebase-auth-divider[_ngcontent-%COMP%]:after{content:"";flex:1 1 0;height:1px;background:#2c4a7929}.firebase-auth-back-btn[_ngcontent-%COMP%]{align-self:flex-start;min-height:30px;border:0;background:transparent;color:#274979e0;font:inherit;font-size:.8rem;font-weight:800;display:inline-flex;align-items:center;gap:.24rem;cursor:pointer;padding:0}.firebase-auth-back-btn[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{width:18px;height:18px;font-size:18px;line-height:18px}.firebase-auth-email-form[_ngcontent-%COMP%]{display:flex;flex-direction:column;gap:.55rem}.firebase-auth-email-tabs[_ngcontent-%COMP%]{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border:1px solid rgba(44,74,121,.18);border-radius:9px;background:#edf3fb;padding:3px}.firebase-auth-email-tabs[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]{min-height:34px;border:0;border-radius:7px;background:transparent;color:#31425dc2;font:inherit;font-size:.82rem;font-weight:850;cursor:pointer}.firebase-auth-email-tabs[_ngcontent-%COMP%]   button.active[_ngcontent-%COMP%]{background:#fff;color:#1c3457fa;box-shadow:0 8px 20px #2548781f}.firebase-auth-email-tabs[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]:disabled{cursor:default;opacity:.7}.firebase-auth-status[_ngcontent-%COMP%]{margin:0;border-radius:8px;background:#eef6ff;color:#1f4e7a;padding:.58rem .66rem;font-size:.78rem;font-weight:800;line-height:1.25}.firebase-auth-email-form[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]{display:flex;flex-direction:column;gap:.28rem;color:#22324ab8;font-size:.74rem;font-weight:800}.firebase-auth-email-form[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]{width:100%;min-height:38px;border-radius:8px;border:1px solid rgba(44,74,121,.22);background:#fff;color:#22324afa;padding:0 .72rem;font:inherit}.firebase-auth-email-form[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]:focus{outline:2px solid rgba(61,108,186,.24);border-color:#3d6cba70}.firebase-auth-password-control[_ngcontent-%COMP%]{position:relative;display:block;width:100%}.firebase-auth-password-control[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]{width:100%;padding-right:2.65rem}.firebase-auth-password-toggle[_ngcontent-%COMP%]{position:absolute;right:.32rem;top:50%;width:32px;height:32px;transform:translateY(-50%);border:0;border-radius:999px;background:transparent;color:#263d5eb8;display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.firebase-auth-password-toggle[_ngcontent-%COMP%]:hover{background:#2c4a7914;color:#1d3456f5;transform:translateY(-50%)}.firebase-auth-password-toggle[_ngcontent-%COMP%]:active, .firebase-auth-password-toggle[_ngcontent-%COMP%]:focus{transform:translateY(-50%)}.firebase-auth-password-toggle[_ngcontent-%COMP%]:disabled{cursor:default;opacity:.7}.firebase-auth-password-toggle[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{width:18px;height:18px;font-size:18px;line-height:18px}.firebase-password-strength[_ngcontent-%COMP%]{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:.55rem;margin-top:-.28rem;color:#3d4b639e;font-size:.68rem;font-weight:850}.firebase-password-strength-lines[_ngcontent-%COMP%]{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.28rem}.firebase-password-strength-lines[_ngcontent-%COMP%]   span[_ngcontent-%COMP%]{height:4px;border-radius:999px;background:#2c4a7929}.firebase-password-strength-lines[_ngcontent-%COMP%]   span.active[_ngcontent-%COMP%]{background:#9aa7b8}.firebase-password-strength.level-1[_ngcontent-%COMP%]{color:#a43b45}.firebase-password-strength.level-1[_ngcontent-%COMP%]   .firebase-password-strength-lines[_ngcontent-%COMP%]   span.active[_ngcontent-%COMP%]{background:#d94d5a}.firebase-password-strength.level-2[_ngcontent-%COMP%]{color:#9a641b}.firebase-password-strength.level-2[_ngcontent-%COMP%]   .firebase-password-strength-lines[_ngcontent-%COMP%]   span.active[_ngcontent-%COMP%]{background:#e39b30}.firebase-password-strength.level-3[_ngcontent-%COMP%]{color:#286f80}.firebase-password-strength.level-3[_ngcontent-%COMP%]   .firebase-password-strength-lines[_ngcontent-%COMP%]   span.active[_ngcontent-%COMP%]{background:#42a9bd}.firebase-password-strength.level-4[_ngcontent-%COMP%]{color:#22744d}.firebase-password-strength.level-4[_ngcontent-%COMP%]   .firebase-password-strength-lines[_ngcontent-%COMP%]   span.active[_ngcontent-%COMP%]{background:#31a66a}.firebase-password-rules[_ngcontent-%COMP%]{display:flex;flex-wrap:wrap;gap:.34rem;margin:-.1rem 0 0;padding:0;list-style:none}.firebase-password-rules[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]{min-height:24px;border-radius:999px;background:#2c4a7912;color:#31425db3;display:inline-flex;align-items:center;gap:.24rem;padding:0 .48rem 0 .34rem;font-size:.68rem;font-weight:850}.firebase-password-rules[_ngcontent-%COMP%]   li.met[_ngcontent-%COMP%]{background:#31a66a1f;color:#22744d}.firebase-password-rules[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{width:14px;height:14px;font-size:14px;line-height:14px}.firebase-auth-error[_ngcontent-%COMP%]{margin:0;color:#9f2f35;font-size:.76rem;font-weight:700}.firebase-auth-main-btn[_ngcontent-%COMP%]{position:relative;overflow:hidden;min-height:42px;border:1px solid rgba(34,96,176,.42);border-radius:12px;background:linear-gradient(180deg,#4f8fdf,#3e79c4);color:#fff;font-size:.88rem;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:.4rem;cursor:pointer}.firebase-auth-main-btn[_ngcontent-%COMP%]:disabled{opacity:.76;cursor:default}.firebase-auth-main-btn[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{width:18px;height:18px;font-size:18px;line-height:18px}.firebase-auth-main-btn[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%], .firebase-auth-main-btn[_ngcontent-%COMP%]   span[_ngcontent-%COMP%]{position:relative;z-index:1}@media(max-width:760px){.firebase-auth-overlay[_ngcontent-%COMP%]{padding:0}.firebase-auth-panel.mobile-fullscreen[_ngcontent-%COMP%]{width:100vw;height:100vh;max-width:100vw;border-radius:0;padding:max(.52rem,env(safe-area-inset-top,0px)) .9rem 1rem}}']})};
var chunkH6J6VVEY=/*#__PURE__*/Object.freeze({__proto__:null,EntryFirebaseAuthPopupComponent:Z});export{L$1 as L,chunkDKRIDDZA as a,chunkH6J6VVEY as b,chunk4Z6VRNA4 as c,chunkTHU2G7JH as d,chunkXAJ5QXFD as e,it as i,oe$1 as o,rt as r};