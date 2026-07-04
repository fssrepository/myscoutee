import{a as Ot,b as Hi,c as Zn}from"./chunk-HUKFCHY5.js";import{a as X,b as Ie,c as oi,d as Un,f as si,j as li,l as Gn}from"./chunk-6F5OXAUO.js";import{a as je,c as Vn,d as ut,e as Re,f as Fn,g as Zt,h as Qt,j as Jt,k as ei,n as ti,u as ii,x as Nn}from"./chunk-B62THUMI.js";import{g as Ln}from"./chunk-EHDTKU6R.js";import{A as Y,B as Ve,C as $n,G as Kn,a as Q,b as Li,c as Bn,d as Se,h as St,i as it,j as Et,k as At,l as zn,m as Ni,n as Hn,o as Yn,q as jn,r as de,s as Wn,t as ce,w as qn,x as Xn,y as Bi,z as zi}from"./chunk-CRMK76M2.js";import{c as Rn,e as Ut,h as In,k as Gt,q as Me,r as ni,t as se,u as De,v as ai,w as ri}from"./chunk-27QA22WO.js";import{a as Te}from"./chunk-DOPSLR5W.js";import{$ as s,$a as wt,$b as W,A as we,B as Oi,Bb as ye,Ca as xn,Cb as Ce,Cc as Mt,Db as g,Dc as xe,Eb as c,F as yn,Fb as u,Fc as $t,Gb as J,Gc as Kt,Hb as ee,Hc as K,Ib as re,Ic as tt,Jb as ct,Jc as En,K as Pi,Kc as An,Lb as R,Lc as On,M as Ti,Mb as oe,Mc as Z,O as Ze,Pb as _,Pc as F,Q as pe,Qb as zt,R as Cn,Rb as d,Rc as Pn,Sb as ge,Sc as Tn,Tb as H,Ub as Ht,V as dt,Va as l,Vb as me,W as z,Wb as I,X as U,Xb as V,Yb as Mn,Z as N,Zb as Yt,_ as Nt,_a as fe,_b as kt,a as Ee,ab as Oe,ac as Je,b as gn,bb as ae,bc as k,ca as Bt,cb as Dn,cc as pt,db as wn,dc as b,e as B,ea as m,eb as ve,ec as M,fa as h,fb as Ii,fc as ze,g as Lt,ga as Qe,gc as Fi,h as A,ha as Ri,ia as j,ja as ne,jb as P,jc as jt,k as bn,kb as G,kc as Wt,lb as T,lc as qt,m as lt,ma as D,na as L,nb as ke,ob as Pe,qb as kn,qc as q,r as vn,ra as E,rc as et,ta as Ae,tc as Sn,ua as ue,ub as Vi,va as Be,vb as w,wa as O,wc as He,xb as C,xc as Ye,yb as x,z as Ge,zc as Xt}from"./chunk-AYREMVY4.js";var Yi=class{_box;_destroyed=new A;_resizeSubject=new A;_resizeObserver;_elementObservables=new Map;constructor(a){this._box=a,typeof ResizeObserver<"u"&&(this._resizeObserver=new ResizeObserver(e=>this._resizeSubject.next(e)))}observe(a){return this._elementObservables.has(a)||this._elementObservables.set(a,new Lt(e=>{let t=this._resizeSubject.subscribe(e);return this._resizeObserver?.observe(a,{box:this._box}),()=>{this._resizeObserver?.unobserve(a),t.unsubscribe(),this._elementObservables.delete(a)}}).pipe(we(e=>e.some(t=>t.target===a)),Ti({bufferSize:1,refCount:!0}),pe(this._destroyed))),this._elementObservables.get(a)}destroy(){this._destroyed.next(),this._destroyed.complete(),this._resizeSubject.complete(),this._elementObservables.clear()}},Qn=(()=>{class n{_cleanupErrorListener;_observers=new Map;_ngZone=s(L);constructor(){typeof ResizeObserver<"u"}ngOnDestroy(){for(let[,e]of this._observers)e.destroy();this._observers.clear(),this._cleanupErrorListener?.()}observe(e,t){let i=t?.box||"content-box";return this._observers.has(i)||this._observers.set(i,new Yi(i)),this._observers.get(i).observe(e)}static \u0275fac=function(t){return new(t||n)};static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})();var rr=["notch"],or=["matFormFieldNotchedOutline",""],sr=["*"],Jn=["iconPrefixContainer"],ea=["textPrefixContainer"],ta=["iconSuffixContainer"],ia=["textSuffixContainer"],lr=["textField"],dr=["*",[["mat-label"]],[["","matPrefix",""],["","matIconPrefix",""]],[["","matTextPrefix",""]],[["","matTextSuffix",""]],[["","matSuffix",""],["","matIconSuffix",""]],[["mat-error"],["","matError",""]],[["mat-hint",3,"align","end"]],[["mat-hint","align","end"]]],cr=["*","mat-label","[matPrefix], [matIconPrefix]","[matTextPrefix]","[matTextSuffix]","[matSuffix], [matIconSuffix]","mat-error, [matError]","mat-hint:not([align='end'])","mat-hint[align='end']"];function pr(n,a){n&1&&J(0,"span",21)}function ur(n,a){if(n&1&&(c(0,"label",20),H(1,1),C(2,pr,1,0,"span",21),u()),n&2){let e=d(2);g("floating",e._shouldLabelFloat())("monitorResize",e._hasOutline())("id",e._labelId),w("for",e._control.disableAutomaticLabeling?null:e._control.id),l(2),x(!e.hideRequiredMarker&&e._control.required?2:-1)}}function mr(n,a){if(n&1&&C(0,ur,3,5,"label",20),n&2){let e=d();x(e._hasFloatingLabel()?0:-1)}}function hr(n,a){n&1&&J(0,"div",7)}function _r(n,a){}function fr(n,a){if(n&1&&Pe(0,_r,0,0,"ng-template",13),n&2){d(2);let e=W(1);g("ngTemplateOutlet",e)}}function gr(n,a){if(n&1&&(c(0,"div",9),C(1,fr,1,1,null,13),u()),n&2){let e=d();g("matFormFieldNotchedOutlineOpen",e._shouldLabelFloat()),l(),x(e._forceDisplayInfixLabel()?-1:1)}}function br(n,a){n&1&&(c(0,"div",10,2),H(2,2),u())}function vr(n,a){n&1&&(c(0,"div",11,3),H(2,3),u())}function yr(n,a){}function Cr(n,a){if(n&1&&Pe(0,yr,0,0,"ng-template",13),n&2){d();let e=W(1);g("ngTemplateOutlet",e)}}function xr(n,a){n&1&&(c(0,"div",14,4),H(2,4),u())}function Dr(n,a){n&1&&(c(0,"div",15,5),H(2,5),u())}function wr(n,a){n&1&&J(0,"div",16)}function kr(n,a){n&1&&(c(0,"div",18),H(1,6),u())}function Mr(n,a){if(n&1&&(c(0,"mat-hint",22),b(1),u()),n&2){let e=d(2);g("id",e._hintLabelId),l(),M(e.hintLabel)}}function Sr(n,a){if(n&1&&(c(0,"div",19),C(1,Mr,2,2,"mat-hint",22),H(2,7),J(3,"div",23),H(4,8),u()),n&2){let e=d();l(),x(e.hintLabel?1:-1)}}var ji=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["mat-label"]]})}return n})(),Er=new N("MatError");var Wi=(()=>{class n{align="start";id=s(ce).getId("mat-mdc-hint-");static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["mat-hint"]],hostAttrs:[1,"mat-mdc-form-field-hint","mat-mdc-form-field-bottom-align"],hostVars:4,hostBindings:function(t,i){t&2&&(oe("id",i.id),w("align",null),k("mat-mdc-form-field-hint-end",i.align==="end"))},inputs:{align:"align",id:"id"}})}return n})(),Ar=new N("MatPrefix");var da=new N("MatSuffix"),qi=(()=>{class n{set _isTextSelector(e){this._isText=!0}_isText=!1;static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["","matSuffix",""],["","matIconSuffix",""],["","matTextSuffix",""]],inputs:{_isTextSelector:[0,"matTextSuffix","_isTextSelector"]},features:[q([{provide:da,useExisting:n}])]})}return n})(),ca=new N("FloatingLabelParent"),na=(()=>{class n{_elementRef=s(O);get floating(){return this._floating}set floating(e){this._floating=e,this.monitorResize&&this._handleResize()}_floating=!1;get monitorResize(){return this._monitorResize}set monitorResize(e){this._monitorResize=e,this._monitorResize?this._subscribeToResize():this._resizeSubscription.unsubscribe()}_monitorResize=!1;_resizeObserver=s(Qn);_ngZone=s(L);_parent=s(ca);_resizeSubscription=new B;constructor(){}ngOnDestroy(){this._resizeSubscription.unsubscribe()}getWidth(){return Or(this._elementRef.nativeElement)}get element(){return this._elementRef.nativeElement}_handleResize(){setTimeout(()=>this._parent._handleLabelResized())}_subscribeToResize(){this._resizeSubscription.unsubscribe(),this._ngZone.runOutsideAngular(()=>{this._resizeSubscription=this._resizeObserver.observe(this._elementRef.nativeElement,{box:"border-box"}).subscribe(()=>this._handleResize())})}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["label","matFormFieldFloatingLabel",""]],hostAttrs:[1,"mdc-floating-label","mat-mdc-floating-label"],hostVars:2,hostBindings:function(t,i){t&2&&k("mdc-floating-label--float-above",i.floating)},inputs:{floating:"floating",monitorResize:"monitorResize"}})}return n})();function Or(n){let a=n;if(a.offsetParent!==null)return a.scrollWidth;let e=a.cloneNode(!0);e.style.setProperty("position","absolute"),e.style.setProperty("transform","translate(-9999px, -9999px)"),document.documentElement.appendChild(e);let t=e.scrollWidth;return e.remove(),t}var aa="mdc-line-ripple--active",di="mdc-line-ripple--deactivating",ra=(()=>{class n{_elementRef=s(O);_cleanupTransitionEnd;constructor(){let e=s(L),t=s(ae);e.runOutsideAngular(()=>{this._cleanupTransitionEnd=t.listen(this._elementRef.nativeElement,"transitionend",this._handleTransitionEnd)})}activate(){let e=this._elementRef.nativeElement.classList;e.remove(di),e.add(aa)}deactivate(){this._elementRef.nativeElement.classList.add(di)}_handleTransitionEnd=e=>{let t=this._elementRef.nativeElement.classList,i=t.contains(di);e.propertyName==="opacity"&&i&&t.remove(aa,di)};ngOnDestroy(){this._cleanupTransitionEnd()}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["div","matFormFieldLineRipple",""]],hostAttrs:[1,"mdc-line-ripple"]})}return n})(),oa=(()=>{class n{_elementRef=s(O);_ngZone=s(L);open=!1;_notch;ngAfterViewInit(){let e=this._elementRef.nativeElement,t=e.querySelector(".mdc-floating-label");t?(e.classList.add("mdc-notched-outline--upgraded"),typeof requestAnimationFrame=="function"&&(t.style.transitionDuration="0s",this._ngZone.runOutsideAngular(()=>{requestAnimationFrame(()=>t.style.transitionDuration="")}))):e.classList.add("mdc-notched-outline--no-label")}_setNotchWidth(e){let t=this._notch.nativeElement;!this.open||!e?t.style.width="":t.style.width=`calc(${e}px * var(--mat-mdc-form-field-floating-label-scale, 0.75) + 9px)`}_setMaxWidth(e){this._notch.nativeElement.style.setProperty("--mat-form-field-notch-max-width",`calc(100% - ${e}px)`)}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["div","matFormFieldNotchedOutline",""]],viewQuery:function(t,i){if(t&1&&me(rr,5),t&2){let r;I(r=V())&&(i._notch=r.first)}},hostAttrs:[1,"mdc-notched-outline"],hostVars:2,hostBindings:function(t,i){t&2&&k("mdc-notched-outline--notched",i.open)},inputs:{open:[0,"matFormFieldNotchedOutlineOpen","open"]},attrs:or,ngContentSelectors:sr,decls:5,vars:0,consts:[["notch",""],[1,"mat-mdc-notch-piece","mdc-notched-outline__leading"],[1,"mat-mdc-notch-piece","mdc-notched-outline__notch"],[1,"mat-mdc-notch-piece","mdc-notched-outline__trailing"]],template:function(t,i){t&1&&(ge(),ct(0,"div",1),ee(1,"div",2,0),H(3),re(),ct(4,"div",3))},encapsulation:2,changeDetection:0})}return n})(),Pt=(()=>{class n{value=null;stateChanges;id;placeholder;ngControl=null;focused=!1;empty=!1;shouldLabelFloat=!1;required=!1;disabled=!1;errorState=!1;controlType;autofilled;userAriaDescribedBy;disableAutomaticLabeling;describedByIds;static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n})}return n})();var We=new N("MatFormField"),Pr=new N("MAT_FORM_FIELD_DEFAULT_OPTIONS"),sa="fill",Tr="auto",la="fixed",Rr="translateY(-50%)",ci=(()=>{class n{_elementRef=s(O);_changeDetectorRef=s(Z);_platform=s(Q);_idGenerator=s(ce);_ngZone=s(L);_defaults=s(Pr,{optional:!0});_currentDirection;_textField;_iconPrefixContainer;_textPrefixContainer;_iconSuffixContainer;_textSuffixContainer;_floatingLabel;_notchedOutline;_lineRipple;_iconPrefixContainerSignal=tt("iconPrefixContainer");_textPrefixContainerSignal=tt("textPrefixContainer");_iconSuffixContainerSignal=tt("iconSuffixContainer");_textSuffixContainerSignal=tt("textSuffixContainer");_prefixSuffixContainers=xe(()=>[this._iconPrefixContainerSignal(),this._textPrefixContainerSignal(),this._iconSuffixContainerSignal(),this._textSuffixContainerSignal()].map(e=>e?.nativeElement).filter(e=>e!==void 0));_formFieldControl;_prefixChildren;_suffixChildren;_errorChildren;_hintChildren;_labelChild=An(ji);get hideRequiredMarker(){return this._hideRequiredMarker}set hideRequiredMarker(e){this._hideRequiredMarker=Ve(e)}_hideRequiredMarker=!1;color="primary";get floatLabel(){return this._floatLabel||this._defaults?.floatLabel||Tr}set floatLabel(e){e!==this._floatLabel&&(this._floatLabel=e,this._changeDetectorRef.markForCheck())}_floatLabel;get appearance(){return this._appearanceSignal()}set appearance(e){let t=e||this._defaults?.appearance||sa;this._appearanceSignal.set(t)}_appearanceSignal=E(sa);get subscriptSizing(){return this._subscriptSizing||this._defaults?.subscriptSizing||la}set subscriptSizing(e){this._subscriptSizing=e||this._defaults?.subscriptSizing||la}_subscriptSizing=null;get hintLabel(){return this._hintLabel}set hintLabel(e){this._hintLabel=e,this._processHints()}_hintLabel="";_hasIconPrefix=!1;_hasTextPrefix=!1;_hasIconSuffix=!1;_hasTextSuffix=!1;_labelId=this._idGenerator.getId("mat-mdc-form-field-label-");_hintLabelId=this._idGenerator.getId("mat-mdc-hint-");_describedByIds;get _control(){return this._explicitFormFieldControl||this._formFieldControl}set _control(e){this._explicitFormFieldControl=e}_destroyed=new A;_isFocused=null;_explicitFormFieldControl;_previousControl=null;_previousControlValidatorFn=null;_stateChanges;_valueChanges;_describedByChanges;_outlineLabelOffsetResizeObserver=null;_animationsDisabled=Se();constructor(){let e=this._defaults,t=s(se);e&&(e.appearance&&(this.appearance=e.appearance),this._hideRequiredMarker=!!e?.hideRequiredMarker,e.color&&(this.color=e.color)),Ae(()=>this._currentDirection=t.valueSignal()),this._syncOutlineLabelOffset()}ngAfterViewInit(){this._updateFocusState(),this._animationsDisabled||this._ngZone.runOutsideAngular(()=>{setTimeout(()=>{this._elementRef.nativeElement.classList.add("mat-form-field-animations-enabled")},300)}),this._changeDetectorRef.detectChanges()}ngAfterContentInit(){this._assertFormFieldControl(),this._initializeSubscript(),this._initializePrefixAndSuffix()}ngAfterContentChecked(){this._assertFormFieldControl(),this._control!==this._previousControl&&(this._initializeControl(this._previousControl),this._control.ngControl&&this._control.ngControl.control&&(this._previousControlValidatorFn=this._control.ngControl.control.validator),this._previousControl=this._control),this._control.ngControl&&this._control.ngControl.control&&this._control.ngControl.control.validator!==this._previousControlValidatorFn&&this._changeDetectorRef.markForCheck()}ngOnDestroy(){this._outlineLabelOffsetResizeObserver?.disconnect(),this._stateChanges?.unsubscribe(),this._valueChanges?.unsubscribe(),this._describedByChanges?.unsubscribe(),this._destroyed.next(),this._destroyed.complete()}getLabelId=xe(()=>this._hasFloatingLabel()?this._labelId:null);getConnectedOverlayOrigin(){return this._textField||this._elementRef}_animateAndLockLabel(){this._hasFloatingLabel()&&(this.floatLabel="always")}_initializeControl(e){let t=this._control,i="mat-mdc-form-field-type-";e&&this._elementRef.nativeElement.classList.remove(i+e.controlType),t.controlType&&this._elementRef.nativeElement.classList.add(i+t.controlType),this._stateChanges?.unsubscribe(),this._stateChanges=t.stateChanges.subscribe(()=>{this._updateFocusState(),this._changeDetectorRef.markForCheck()}),this._describedByChanges?.unsubscribe(),this._describedByChanges=t.stateChanges.pipe(Ze([void 0,void 0]),vn(()=>[t.errorState,t.userAriaDescribedBy]),Pi(),we(([[r,o],[p,f]])=>r!==p||o!==f)).subscribe(()=>this._syncDescribedByIds()),this._valueChanges?.unsubscribe(),t.ngControl&&t.ngControl.valueChanges&&(this._valueChanges=t.ngControl.valueChanges.pipe(pe(this._destroyed)).subscribe(()=>this._changeDetectorRef.markForCheck()))}_checkPrefixAndSuffixTypes(){this._hasIconPrefix=!!this._prefixChildren.find(e=>!e._isText),this._hasTextPrefix=!!this._prefixChildren.find(e=>e._isText),this._hasIconSuffix=!!this._suffixChildren.find(e=>!e._isText),this._hasTextSuffix=!!this._suffixChildren.find(e=>e._isText)}_initializePrefixAndSuffix(){this._checkPrefixAndSuffixTypes(),Ge(this._prefixChildren.changes,this._suffixChildren.changes).subscribe(()=>{this._checkPrefixAndSuffixTypes(),this._changeDetectorRef.markForCheck()})}_initializeSubscript(){this._hintChildren.changes.subscribe(()=>{this._processHints(),this._changeDetectorRef.markForCheck()}),this._errorChildren.changes.subscribe(()=>{this._syncDescribedByIds(),this._changeDetectorRef.markForCheck()}),this._validateHints(),this._syncDescribedByIds()}_assertFormFieldControl(){this._control}_updateFocusState(){let e=this._control.focused;e&&!this._isFocused?(this._isFocused=!0,this._lineRipple?.activate()):!e&&(this._isFocused||this._isFocused===null)&&(this._isFocused=!1,this._lineRipple?.deactivate()),this._elementRef.nativeElement.classList.toggle("mat-focused",e),this._textField?.nativeElement.classList.toggle("mdc-text-field--focused",e)}_syncOutlineLabelOffset(){Pn({earlyRead:()=>{if(this._appearanceSignal()!=="outline")return this._outlineLabelOffsetResizeObserver?.disconnect(),null;if(globalThis.ResizeObserver){this._outlineLabelOffsetResizeObserver||=new globalThis.ResizeObserver(()=>{this._writeOutlinedLabelStyles(this._getOutlinedLabelOffset())});for(let e of this._prefixSuffixContainers())this._outlineLabelOffsetResizeObserver.observe(e,{box:"border-box"})}return this._getOutlinedLabelOffset()},write:e=>this._writeOutlinedLabelStyles(e())})}_shouldAlwaysFloat(){return this.floatLabel==="always"}_hasOutline(){return this.appearance==="outline"}_forceDisplayInfixLabel(){return!this._platform.isBrowser&&this._prefixChildren.length&&!this._shouldLabelFloat()}_hasFloatingLabel=xe(()=>!!this._labelChild());_shouldLabelFloat(){return this._hasFloatingLabel()?this._control.shouldLabelFloat||this._shouldAlwaysFloat():!1}_shouldForward(e){let t=this._control?this._control.ngControl:null;return t&&t[e]}_getSubscriptMessageType(){return this._errorChildren&&this._errorChildren.length>0&&this._control.errorState?"error":"hint"}_handleLabelResized(){this._refreshOutlineNotchWidth()}_refreshOutlineNotchWidth(){!this._hasOutline()||!this._floatingLabel||!this._shouldLabelFloat()?this._notchedOutline?._setNotchWidth(0):this._notchedOutline?._setNotchWidth(this._floatingLabel.getWidth())}_processHints(){this._validateHints(),this._syncDescribedByIds()}_validateHints(){this._hintChildren}_syncDescribedByIds(){if(this._control){let e=[];if(this._control.userAriaDescribedBy&&typeof this._control.userAriaDescribedBy=="string"&&e.push(...this._control.userAriaDescribedBy.split(" ")),this._getSubscriptMessageType()==="hint"){let r=this._hintChildren?this._hintChildren.find(p=>p.align==="start"):null,o=this._hintChildren?this._hintChildren.find(p=>p.align==="end"):null;r?e.push(r.id):this._hintLabel&&e.push(this._hintLabelId),o&&e.push(o.id)}else this._errorChildren&&e.push(...this._errorChildren.map(r=>r.id));let t=this._control.describedByIds,i;if(t){let r=this._describedByIds||e;i=e.concat(t.filter(o=>o&&!r.includes(o)))}else i=e;this._control.setDescribedByIds(i),this._describedByIds=e}}_getOutlinedLabelOffset(){if(!this._hasOutline()||!this._floatingLabel)return null;if(!this._iconPrefixContainer&&!this._textPrefixContainer)return["",null];if(!this._isAttachedToDom())return null;let e=this._iconPrefixContainer?.nativeElement,t=this._textPrefixContainer?.nativeElement,i=this._iconSuffixContainer?.nativeElement,r=this._textSuffixContainer?.nativeElement,o=e?.getBoundingClientRect().width??0,p=t?.getBoundingClientRect().width??0,f=i?.getBoundingClientRect().width??0,y=r?.getBoundingClientRect().width??0,v=this._currentDirection==="rtl"?"-1":"1",S=`${o+p}px`,le=`calc(${v} * (${S} + var(--mat-mdc-form-field-label-offset-x, 0px)))`,ie=`var(--mat-mdc-form-field-label-transform, ${Rr} translateX(${le}))`,_e=o+p+f+y;return[ie,_e]}_writeOutlinedLabelStyles(e){if(e!==null){let[t,i]=e;this._floatingLabel&&(this._floatingLabel.element.style.transform=t),i!==null&&this._notchedOutline?._setMaxWidth(i)}}_isAttachedToDom(){let e=this._elementRef.nativeElement;if(e.getRootNode){let t=e.getRootNode();return t&&t!==e}return document.documentElement.contains(e)}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-form-field"]],contentQueries:function(t,i,r){if(t&1&&(Mn(r,i._labelChild,ji,5),Ht(r,Pt,5)(r,Ar,5)(r,da,5)(r,Er,5)(r,Wi,5)),t&2){kt();let o;I(o=V())&&(i._formFieldControl=o.first),I(o=V())&&(i._prefixChildren=o),I(o=V())&&(i._suffixChildren=o),I(o=V())&&(i._errorChildren=o),I(o=V())&&(i._hintChildren=o)}},viewQuery:function(t,i){if(t&1&&(Yt(i._iconPrefixContainerSignal,Jn,5)(i._textPrefixContainerSignal,ea,5)(i._iconSuffixContainerSignal,ta,5)(i._textSuffixContainerSignal,ia,5),me(lr,5)(Jn,5)(ea,5)(ta,5)(ia,5)(na,5)(oa,5)(ra,5)),t&2){kt(4);let r;I(r=V())&&(i._textField=r.first),I(r=V())&&(i._iconPrefixContainer=r.first),I(r=V())&&(i._textPrefixContainer=r.first),I(r=V())&&(i._iconSuffixContainer=r.first),I(r=V())&&(i._textSuffixContainer=r.first),I(r=V())&&(i._floatingLabel=r.first),I(r=V())&&(i._notchedOutline=r.first),I(r=V())&&(i._lineRipple=r.first)}},hostAttrs:[1,"mat-mdc-form-field"],hostVars:38,hostBindings:function(t,i){t&2&&k("mat-mdc-form-field-label-always-float",i._shouldAlwaysFloat())("mat-mdc-form-field-has-icon-prefix",i._hasIconPrefix)("mat-mdc-form-field-has-icon-suffix",i._hasIconSuffix)("mat-form-field-invalid",i._control.errorState)("mat-form-field-disabled",i._control.disabled)("mat-form-field-autofilled",i._control.autofilled)("mat-form-field-appearance-fill",i.appearance=="fill")("mat-form-field-appearance-outline",i.appearance=="outline")("mat-form-field-hide-placeholder",i._hasFloatingLabel()&&!i._shouldLabelFloat())("mat-primary",i.color!=="accent"&&i.color!=="warn")("mat-accent",i.color==="accent")("mat-warn",i.color==="warn")("ng-untouched",i._shouldForward("untouched"))("ng-touched",i._shouldForward("touched"))("ng-pristine",i._shouldForward("pristine"))("ng-dirty",i._shouldForward("dirty"))("ng-valid",i._shouldForward("valid"))("ng-invalid",i._shouldForward("invalid"))("ng-pending",i._shouldForward("pending"))},inputs:{hideRequiredMarker:"hideRequiredMarker",color:"color",floatLabel:"floatLabel",appearance:"appearance",subscriptSizing:"subscriptSizing",hintLabel:"hintLabel"},exportAs:["matFormField"],features:[q([{provide:We,useExisting:n},{provide:ca,useExisting:n}])],ngContentSelectors:cr,decls:18,vars:21,consts:[["labelTemplate",""],["textField",""],["iconPrefixContainer",""],["textPrefixContainer",""],["textSuffixContainer",""],["iconSuffixContainer",""],[1,"mat-mdc-text-field-wrapper","mdc-text-field",3,"click"],[1,"mat-mdc-form-field-focus-overlay"],[1,"mat-mdc-form-field-flex"],["matFormFieldNotchedOutline","",3,"matFormFieldNotchedOutlineOpen"],[1,"mat-mdc-form-field-icon-prefix"],[1,"mat-mdc-form-field-text-prefix"],[1,"mat-mdc-form-field-infix"],[3,"ngTemplateOutlet"],[1,"mat-mdc-form-field-text-suffix"],[1,"mat-mdc-form-field-icon-suffix"],["matFormFieldLineRipple",""],["aria-atomic","true","aria-live","polite",1,"mat-mdc-form-field-subscript-wrapper","mat-mdc-form-field-bottom-align"],[1,"mat-mdc-form-field-error-wrapper"],[1,"mat-mdc-form-field-hint-wrapper"],["matFormFieldFloatingLabel","",3,"floating","monitorResize","id"],["aria-hidden","true",1,"mat-mdc-form-field-required-marker","mdc-floating-label--required"],[3,"id"],[1,"mat-mdc-form-field-hint-spacer"]],template:function(t,i){if(t&1&&(ge(dr),Pe(0,mr,1,1,"ng-template",null,0,Xt),c(2,"div",6,1),_("click",function(o){return i._control.onContainerClick(o)}),C(4,hr,1,0,"div",7),c(5,"div",8),C(6,gr,2,2,"div",9),C(7,br,3,0,"div",10),C(8,vr,3,0,"div",11),c(9,"div",12),C(10,Cr,1,1,null,13),H(11),u(),C(12,xr,3,0,"div",14),C(13,Dr,3,0,"div",15),u(),C(14,wr,1,0,"div",16),u(),c(15,"div",17),C(16,kr,2,0,"div",18)(17,Sr,5,1,"div",19),u()),t&2){let r;l(2),k("mdc-text-field--filled",!i._hasOutline())("mdc-text-field--outlined",i._hasOutline())("mdc-text-field--no-label",!i._hasFloatingLabel())("mdc-text-field--disabled",i._control.disabled)("mdc-text-field--invalid",i._control.errorState),l(2),x(!i._hasOutline()&&!i._control.disabled?4:-1),l(2),x(i._hasOutline()?6:-1),l(),x(i._hasIconPrefix?7:-1),l(),x(i._hasTextPrefix?8:-1),l(2),x(!i._hasOutline()||i._forceDisplayInfixLabel()?10:-1),l(2),x(i._hasTextSuffix?12:-1),l(),x(i._hasIconSuffix?13:-1),l(),x(i._hasOutline()?-1:14),l(),k("mat-mdc-form-field-subscript-dynamic-size",i.subscriptSizing==="dynamic");let o=i._getSubscriptMessageType();l(),x((r=o)==="error"?16:r==="hint"?17:-1)}},dependencies:[na,oa,In,ra,Wi],styles:[`.mdc-text-field {
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
`],encapsulation:2,changeDetection:0})}return n})();var Ir=20,mt=(()=>{class n{_ngZone=s(L);_platform=s(Q);_renderer=s(Oe).createRenderer(null,null);_cleanupGlobalListener;constructor(){}_scrolled=new A;_scrolledCount=0;scrollContainers=new Map;register(e){this.scrollContainers.has(e)||this.scrollContainers.set(e,e.elementScrolled().subscribe(()=>this._scrolled.next(e)))}deregister(e){let t=this.scrollContainers.get(e);t&&(t.unsubscribe(),this.scrollContainers.delete(e))}scrolled(e=Ir){return this._platform.isBrowser?new Lt(t=>{this._cleanupGlobalListener||(this._cleanupGlobalListener=this._ngZone.runOutsideAngular(()=>this._renderer.listen("document","scroll",()=>this._scrolled.next())));let i=e>0?this._scrolled.pipe(Oi(e)).subscribe(t):this._scrolled.subscribe(t);return this._scrolledCount++,()=>{i.unsubscribe(),this._scrolledCount--,this._scrolledCount||(this._cleanupGlobalListener?.(),this._cleanupGlobalListener=void 0)}}):lt()}ngOnDestroy(){this._cleanupGlobalListener?.(),this._cleanupGlobalListener=void 0,this.scrollContainers.forEach((e,t)=>this.deregister(t)),this._scrolled.complete()}ancestorScrolled(e,t){let i=this.getAncestorScrollContainers(e);return this.scrolled(t).pipe(we(r=>!r||i.indexOf(r)>-1))}getAncestorScrollContainers(e){let t=[];return this.scrollContainers.forEach((i,r)=>{this._scrollableContainsElement(r,e)&&t.push(r)}),t}_scrollableContainsElement(e,t){let i=At(t),r=e.getElementRef().nativeElement;do if(i==r)return!0;while(i=i.parentElement);return!1}static \u0275fac=function(t){return new(t||n)};static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})();var Vr=20,ht=(()=>{class n{_platform=s(Q);_listeners;_viewportSize=null;_change=new A;_document=s(ne);constructor(){let e=s(L),t=s(Oe).createRenderer(null,null);e.runOutsideAngular(()=>{if(this._platform.isBrowser){let i=r=>this._change.next(r);this._listeners=[t.listen("window","resize",i),t.listen("window","orientationchange",i)]}this.change().subscribe(()=>this._viewportSize=null)})}ngOnDestroy(){this._listeners?.forEach(e=>e()),this._change.complete()}getViewportSize(){this._viewportSize||this._updateViewportSize();let e={width:this._viewportSize.width,height:this._viewportSize.height};return this._platform.isBrowser||(this._viewportSize=null),e}getViewportRect(){let e=this.getViewportScrollPosition(),{width:t,height:i}=this.getViewportSize();return{top:e.top,left:e.left,bottom:e.top+i,right:e.left+t,height:i,width:t}}getViewportScrollPosition(){if(!this._platform.isBrowser)return{top:0,left:0};let e=this._document,t=this._getWindow(),i=e.documentElement,r=i.getBoundingClientRect(),o=-r.top||e.body?.scrollTop||t.scrollY||i.scrollTop||0,p=-r.left||e.body?.scrollLeft||t.scrollX||i.scrollLeft||0;return{top:o,left:p}}change(e=Vr){return e>0?this._change.pipe(Oi(e)):this._change}_getWindow(){return this._document.defaultView||window}_updateViewportSize(){let e=this._getWindow();this._viewportSize=this._platform.isBrowser?{width:e.innerWidth,height:e.innerHeight}:{width:0,height:0}}static \u0275fac=function(t){return new(t||n)};static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})();var nt=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=G({type:n});static \u0275inj=U({})}return n})(),Xi=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=G({type:n});static \u0275inj=U({imports:[De,nt,De,nt]})}return n})();var Tt=class{_attachedHost=null;attach(a){return this._attachedHost=a,a.attach(this)}detach(){let a=this._attachedHost;a!=null&&(this._attachedHost=null,a.detach())}get isAttached(){return this._attachedHost!=null}setAttachedHost(a){this._attachedHost=a}},qe=class extends Tt{component;viewContainerRef;injector;projectableNodes;bindings;constructor(a,e,t,i,r){super(),this.component=a,this.viewContainerRef=e,this.injector=t,this.projectableNodes=i,this.bindings=r||null}},Xe=class extends Tt{templateRef;viewContainerRef;context;injector;constructor(a,e,t,i){super(),this.templateRef=a,this.viewContainerRef=e,this.context=t,this.injector=i}get origin(){return this.templateRef.elementRef}attach(a,e=this.context){return this.context=e,super.attach(a)}detach(){return this.context=void 0,super.detach()}},$i=class extends Tt{element;constructor(a){super(),this.element=a instanceof O?a.nativeElement:a}},pi=class{_attachedPortal=null;_disposeFn=null;_isDisposed=!1;hasAttached(){return!!this._attachedPortal}attach(a){if(a instanceof qe)return this._attachedPortal=a,this.attachComponentPortal(a);if(a instanceof Xe)return this._attachedPortal=a,this.attachTemplatePortal(a);if(this.attachDomPortal&&a instanceof $i)return this._attachedPortal=a,this.attachDomPortal(a)}attachDomPortal=null;detach(){this._attachedPortal&&(this._attachedPortal.setAttachedHost(null),this._attachedPortal=null),this._invokeDisposeFn()}dispose(){this.hasAttached()&&this.detach(),this._invokeDisposeFn(),this._isDisposed=!0}setDisposeFn(a){this._disposeFn=a}_invokeDisposeFn(){this._disposeFn&&(this._disposeFn(),this._disposeFn=null)}},ui=class extends pi{outletElement;_appRef;_defaultInjector;constructor(a,e,t){super(),this.outletElement=a,this._appRef=e,this._defaultInjector=t}attachComponentPortal(a){let e;if(a.viewContainerRef){let t=a.injector||a.viewContainerRef.injector,i=t.get(Ii,null,{optional:!0})||void 0;e=a.viewContainerRef.createComponent(a.component,{index:a.viewContainerRef.length,injector:t,ngModuleRef:i,projectableNodes:a.projectableNodes||void 0,bindings:a.bindings||void 0}),this.setDisposeFn(()=>e.destroy())}else{let t=this._appRef,i=a.injector||this._defaultInjector||j.NULL,r=i.get(Bt,t.injector);e=Tn(a.component,{elementInjector:i,environmentInjector:r,projectableNodes:a.projectableNodes||void 0,bindings:a.bindings||void 0}),t.attachView(e.hostView),this.setDisposeFn(()=>{t.viewCount>0&&t.detachView(e.hostView),e.destroy()})}return this.outletElement.appendChild(this._getComponentRootNode(e)),this._attachedPortal=a,e}attachTemplatePortal(a){let e=a.viewContainerRef,t=e.createEmbeddedView(a.templateRef,a.context,{injector:a.injector});return t.rootNodes.forEach(i=>this.outletElement.appendChild(i)),t.detectChanges(),this.setDisposeFn(()=>{let i=e.indexOf(t);i!==-1&&e.remove(i)}),this._attachedPortal=a,t}attachDomPortal=a=>{let e=a.element;e.parentNode;let t=this.outletElement.ownerDocument.createComment("dom-portal");e.parentNode.insertBefore(t,e),this.outletElement.appendChild(e),this._attachedPortal=a,super.setDisposeFn(()=>{t.parentNode&&t.parentNode.replaceChild(e,t)})};dispose(){super.dispose(),this.outletElement.remove()}_getComponentRootNode(a){return a.hostView.rootNodes[0]}};var Ki=(()=>{class n extends pi{_moduleRef=s(Ii,{optional:!0});_document=s(ne);_viewContainerRef=s(ve);_isInitialized=!1;_attachedRef=null;constructor(){super()}get portal(){return this._attachedPortal}set portal(e){this.hasAttached()&&!e&&!this._isInitialized||(this.hasAttached()&&super.detach(),e&&super.attach(e),this._attachedPortal=e||null)}attached=new D;get attachedRef(){return this._attachedRef}ngOnInit(){this._isInitialized=!0}ngOnDestroy(){super.dispose(),this._attachedRef=this._attachedPortal=null}attachComponentPortal(e){e.setAttachedHost(this);let t=e.viewContainerRef!=null?e.viewContainerRef:this._viewContainerRef,i=t.createComponent(e.component,{index:t.length,injector:e.injector||t.injector,projectableNodes:e.projectableNodes||void 0,ngModuleRef:this._moduleRef||void 0,bindings:e.bindings||void 0});return t!==this._viewContainerRef&&this._getRootNode().appendChild(i.hostView.rootNodes[0]),super.setDisposeFn(()=>i.destroy()),this._attachedPortal=e,this._attachedRef=i,this.attached.emit(i),i}attachTemplatePortal(e){e.setAttachedHost(this);let t=this._viewContainerRef.createEmbeddedView(e.templateRef,e.context,{injector:e.injector});return super.setDisposeFn(()=>this._viewContainerRef.clear()),this._attachedPortal=e,this._attachedRef=t,this.attached.emit(t),t}attachDomPortal=e=>{let t=e.element;t.parentNode;let i=this._document.createComment("dom-portal");e.setAttachedHost(this),t.parentNode.insertBefore(i,t),this._getRootNode().appendChild(t),this._attachedPortal=e,super.setDisposeFn(()=>{i.parentNode&&i.parentNode.replaceChild(t,i)})};_getRootNode(){let e=this._viewContainerRef.element.nativeElement;return e.nodeType===e.ELEMENT_NODE?e:e.parentNode}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["","cdkPortalOutlet",""]],inputs:{portal:[0,"cdkPortalOutlet","portal"]},outputs:{attached:"attached"},exportAs:["cdkPortalOutlet"],features:[ke]})}return n})(),mi=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=G({type:n});static \u0275inj=U({})}return n})();var pa=Xn();function yi(n){return new hi(n.get(ht),n.get(ne))}var hi=class{_viewportRuler;_previousHTMLStyles={top:"",left:""};_previousScrollPosition;_isEnabled=!1;_document;constructor(a,e){this._viewportRuler=a,this._document=e}attach(){}enable(){if(this._canBeEnabled()){let a=this._document.documentElement;this._previousScrollPosition=this._viewportRuler.getViewportScrollPosition(),this._previousHTMLStyles.left=a.style.left||"",this._previousHTMLStyles.top=a.style.top||"",a.style.left=Y(-this._previousScrollPosition.left),a.style.top=Y(-this._previousScrollPosition.top),a.classList.add("cdk-global-scrollblock"),this._isEnabled=!0}}disable(){if(this._isEnabled){let a=this._document.documentElement,e=this._document.body,t=a.style,i=e.style,r=t.scrollBehavior||"",o=i.scrollBehavior||"";this._isEnabled=!1,t.left=this._previousHTMLStyles.left,t.top=this._previousHTMLStyles.top,a.classList.remove("cdk-global-scrollblock"),pa&&(t.scrollBehavior=i.scrollBehavior="auto"),window.scroll(this._previousScrollPosition.left,this._previousScrollPosition.top),pa&&(t.scrollBehavior=r,i.scrollBehavior=o)}}_canBeEnabled(){if(this._document.documentElement.classList.contains("cdk-global-scrollblock")||this._isEnabled)return!1;let e=this._document.documentElement,t=this._viewportRuler.getViewportSize();return e.scrollHeight>t.height||e.scrollWidth>t.width}};function ba(n,a){return new _i(n.get(mt),n.get(L),n.get(ht),a)}var _i=class{_scrollDispatcher;_ngZone;_viewportRuler;_config;_scrollSubscription=null;_overlayRef;_initialScrollPosition;constructor(a,e,t,i){this._scrollDispatcher=a,this._ngZone=e,this._viewportRuler=t,this._config=i}attach(a){this._overlayRef,this._overlayRef=a}enable(){if(this._scrollSubscription)return;let a=this._scrollDispatcher.scrolled(0).pipe(we(e=>!e||!this._overlayRef.overlayElement.contains(e.getElementRef().nativeElement)));this._config&&this._config.threshold&&this._config.threshold>1?(this._initialScrollPosition=this._viewportRuler.getViewportScrollPosition().top,this._scrollSubscription=a.subscribe(()=>{let e=this._viewportRuler.getViewportScrollPosition().top;Math.abs(e-this._initialScrollPosition)>this._config.threshold?this._detach():this._overlayRef.updatePosition()})):this._scrollSubscription=a.subscribe(this._detach)}disable(){this._scrollSubscription&&(this._scrollSubscription.unsubscribe(),this._scrollSubscription=null)}detach(){this.disable(),this._overlayRef=null}_detach=()=>{this.disable(),this._overlayRef.hasAttached()&&this._ngZone.run(()=>this._overlayRef.detach())}};var Rt=class{enable(){}disable(){}attach(){}};function Ui(n,a){return a.some(e=>{let t=n.bottom<e.top,i=n.top>e.bottom,r=n.right<e.left,o=n.left>e.right;return t||i||r||o})}function ua(n,a){return a.some(e=>{let t=n.top<e.top,i=n.bottom>e.bottom,r=n.left<e.left,o=n.right>e.right;return t||i||r||o})}function Fe(n,a){return new fi(n.get(mt),n.get(ht),n.get(L),a)}var fi=class{_scrollDispatcher;_viewportRuler;_ngZone;_config;_scrollSubscription=null;_overlayRef;constructor(a,e,t,i){this._scrollDispatcher=a,this._viewportRuler=e,this._ngZone=t,this._config=i}attach(a){this._overlayRef,this._overlayRef=a}enable(){if(!this._scrollSubscription){let a=this._config?this._config.scrollThrottle:0;this._scrollSubscription=this._scrollDispatcher.scrolled(a).subscribe(()=>{if(this._overlayRef.updatePosition(),this._config&&this._config.autoClose){let e=this._overlayRef.overlayElement.getBoundingClientRect(),{width:t,height:i}=this._viewportRuler.getViewportSize();Ui(e,[{width:t,height:i,bottom:i,right:t,top:0,left:0}])&&(this.disable(),this._ngZone.run(()=>this._overlayRef.detach()))}})}}disable(){this._scrollSubscription&&(this._scrollSubscription.unsubscribe(),this._scrollSubscription=null)}detach(){this.disable(),this._overlayRef=null}},va=(()=>{class n{_injector=s(j);constructor(){}noop=()=>new Rt;close=e=>ba(this._injector,e);block=()=>yi(this._injector);reposition=e=>Fe(this._injector,e);static \u0275fac=function(t){return new(t||n)};static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})(),rt=class{positionStrategy;scrollStrategy=new Rt;panelClass="";hasBackdrop=!1;backdropClass="cdk-overlay-dark-backdrop";disableAnimations;width;height;minWidth;minHeight;maxWidth;maxHeight;direction;disposeOnNavigation=!1;usePopover;eventPredicate;constructor(a){if(a){let e=Object.keys(a);for(let t of e)a[t]!==void 0&&(this[t]=a[t])}}};var gi=class{connectionPair;scrollableViewProperties;constructor(a,e){this.connectionPair=a,this.scrollableViewProperties=e}};var ya=(()=>{class n{_attachedOverlays=[];_document=s(ne);_isAttached=!1;constructor(){}ngOnDestroy(){this.detach()}add(e){this.remove(e),this._attachedOverlays.push(e)}remove(e){let t=this._attachedOverlays.indexOf(e);t>-1&&this._attachedOverlays.splice(t,1),this._attachedOverlays.length===0&&this.detach()}canReceiveEvent(e,t,i){return i.observers.length<1?!1:e.eventPredicate?e.eventPredicate(t):!0}static \u0275fac=function(t){return new(t||n)};static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})(),Ca=(()=>{class n extends ya{_ngZone=s(L);_renderer=s(Oe).createRenderer(null,null);_cleanupKeydown;add(e){super.add(e),this._isAttached||(this._ngZone.runOutsideAngular(()=>{this._cleanupKeydown=this._renderer.listen("body","keydown",this._keydownListener)}),this._isAttached=!0)}detach(){this._isAttached&&(this._cleanupKeydown?.(),this._isAttached=!1)}_keydownListener=e=>{let t=this._attachedOverlays;for(let i=t.length-1;i>-1;i--){let r=t[i];if(this.canReceiveEvent(r,e,r._keydownEvents)){this._ngZone.run(()=>r._keydownEvents.next(e));break}}};static \u0275fac=(()=>{let e;return function(i){return(e||(e=Be(n)))(i||n)}})();static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})(),xa=(()=>{class n extends ya{_platform=s(Q);_ngZone=s(L);_renderer=s(Oe).createRenderer(null,null);_cursorOriginalValue;_cursorStyleIsSet=!1;_pointerDownEventTarget=null;_cleanups;add(e){if(super.add(e),!this._isAttached){let t=this._document.body,i={capture:!0},r=this._renderer;this._cleanups=this._ngZone.runOutsideAngular(()=>[r.listen(t,"pointerdown",this._pointerDownListener,i),r.listen(t,"click",this._clickListener,i),r.listen(t,"auxclick",this._clickListener,i),r.listen(t,"contextmenu",this._clickListener,i)]),this._platform.IOS&&!this._cursorStyleIsSet&&(this._cursorOriginalValue=t.style.cursor,t.style.cursor="pointer",this._cursorStyleIsSet=!0),this._isAttached=!0}}detach(){this._isAttached&&(this._cleanups?.forEach(e=>e()),this._cleanups=void 0,this._platform.IOS&&this._cursorStyleIsSet&&(this._document.body.style.cursor=this._cursorOriginalValue,this._cursorStyleIsSet=!1),this._isAttached=!1)}_pointerDownListener=e=>{this._pointerDownEventTarget=it(e)};_clickListener=e=>{let t=it(e),i=e.type==="click"&&this._pointerDownEventTarget?this._pointerDownEventTarget:t;this._pointerDownEventTarget=null;let r=this._attachedOverlays.slice();for(let o=r.length-1;o>-1;o--){let p=r[o],f=p._outsidePointerEvents;if(!(!p.hasAttached()||!this.canReceiveEvent(p,e,f))){if(ma(p.overlayElement,t)||ma(p.overlayElement,i))break;this._ngZone?this._ngZone.run(()=>f.next(e)):f.next(e)}}};static \u0275fac=(()=>{let e;return function(i){return(e||(e=Be(n)))(i||n)}})();static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})();function ma(n,a){let e=typeof ShadowRoot<"u"&&ShadowRoot,t=a;for(;t;){if(t===n)return!0;t=e&&t instanceof ShadowRoot?t.host:t.parentNode}return!1}var Da=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["ng-component"]],hostAttrs:["cdk-overlay-style-loader",""],decls:0,vars:0,template:function(t,i){},styles:[`.cdk-overlay-container, .cdk-global-overlay-wrapper {
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
`],encapsulation:2,changeDetection:0})}return n})(),wa=(()=>{class n{_platform=s(Q);_containerElement;_document=s(ne);_styleLoader=s(Me);constructor(){}ngOnDestroy(){this._containerElement?.remove()}getContainerElement(){return this._loadStyles(),this._containerElement||this._createContainer(),this._containerElement}_createContainer(){let e="cdk-overlay-container";if(this._platform.isBrowser||Bi()){let i=this._document.querySelectorAll(`.${e}[platform="server"], .${e}[platform="test"]`);for(let r=0;r<i.length;r++)i[r].remove()}let t=this._document.createElement("div");t.classList.add(e),Bi()?t.setAttribute("platform","test"):this._platform.isBrowser||t.setAttribute("platform","server"),this._document.body.appendChild(t),this._containerElement=t}_loadStyles(){this._styleLoader.load(Da)}static \u0275fac=function(t){return new(t||n)};static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})(),Gi=class{_renderer;_ngZone;element;_cleanupClick;_cleanupTransitionEnd;_fallbackTimeout;constructor(a,e,t,i){this._renderer=e,this._ngZone=t,this.element=a.createElement("div"),this.element.classList.add("cdk-overlay-backdrop"),this._cleanupClick=e.listen(this.element,"click",i)}detach(){this._ngZone.runOutsideAngular(()=>{let a=this.element;clearTimeout(this._fallbackTimeout),this._cleanupTransitionEnd?.(),this._cleanupTransitionEnd=this._renderer.listen(a,"transitionend",this.dispose),this._fallbackTimeout=setTimeout(this.dispose,500),a.style.pointerEvents="none",a.classList.remove("cdk-overlay-backdrop-showing")})}dispose=()=>{clearTimeout(this._fallbackTimeout),this._cleanupClick?.(),this._cleanupTransitionEnd?.(),this._cleanupClick=this._cleanupTransitionEnd=this._fallbackTimeout=void 0,this.element.remove()}};function Qi(n){return n&&n.nodeType===1}var bi=class{_portalOutlet;_host;_pane;_config;_ngZone;_keyboardDispatcher;_document;_location;_outsideClickDispatcher;_animationsDisabled;_injector;_renderer;_backdropClick=new A;_attachments=new A;_detachments=new A;_positionStrategy;_scrollStrategy;_locationChanges=B.EMPTY;_backdropRef=null;_detachContentMutationObserver;_detachContentAfterRenderRef;_disposed=!1;_previousHostParent;_keydownEvents=new A;_outsidePointerEvents=new A;_afterNextRenderRef;constructor(a,e,t,i,r,o,p,f,y,v=!1,S,te){this._portalOutlet=a,this._host=e,this._pane=t,this._config=i,this._ngZone=r,this._keyboardDispatcher=o,this._document=p,this._location=f,this._outsideClickDispatcher=y,this._animationsDisabled=v,this._injector=S,this._renderer=te,i.scrollStrategy&&(this._scrollStrategy=i.scrollStrategy,this._scrollStrategy.attach(this)),this._positionStrategy=i.positionStrategy}get overlayElement(){return this._pane}get backdropElement(){return this._backdropRef?.element||null}get hostElement(){return this._host}get eventPredicate(){return this._config?.eventPredicate||null}attach(a){if(this._disposed)return null;this._attachHost();let e=this._portalOutlet.attach(a);return this._positionStrategy?.attach(this),this._updateStackingOrder(),this._updateElementSize(),this._updateElementDirection(),this._scrollStrategy&&this._scrollStrategy.enable(),this._afterNextRenderRef?.destroy(),this._afterNextRenderRef=fe(()=>{this.hasAttached()&&this.updatePosition()},{injector:this._injector}),this._togglePointerEvents(!0),this._config.hasBackdrop&&this._attachBackdrop(),this._config.panelClass&&this._toggleClasses(this._pane,this._config.panelClass,!0),this._attachments.next(),this._completeDetachContent(),this._keyboardDispatcher.add(this),this._config.disposeOnNavigation&&(this._locationChanges=this._location.subscribe(()=>this.dispose())),this._outsideClickDispatcher.add(this),typeof e?.onDestroy=="function"&&e.onDestroy(()=>{this.hasAttached()&&this._ngZone.runOutsideAngular(()=>Promise.resolve().then(()=>this.detach()))}),e}detach(){if(!this.hasAttached())return;this.detachBackdrop(),this._togglePointerEvents(!1),this._positionStrategy&&this._positionStrategy.detach&&this._positionStrategy.detach(),this._scrollStrategy&&this._scrollStrategy.disable();let a=this._portalOutlet.detach();return this._detachments.next(),this._completeDetachContent(),this._keyboardDispatcher.remove(this),this._detachContentWhenEmpty(),this._locationChanges.unsubscribe(),this._outsideClickDispatcher.remove(this),a}dispose(){if(this._disposed)return;let a=this.hasAttached();this._positionStrategy&&this._positionStrategy.dispose(),this._disposeScrollStrategy(),this._backdropRef?.dispose(),this._locationChanges.unsubscribe(),this._keyboardDispatcher.remove(this),this._portalOutlet.dispose(),this._attachments.complete(),this._backdropClick.complete(),this._keydownEvents.complete(),this._outsidePointerEvents.complete(),this._outsideClickDispatcher.remove(this),this._host?.remove(),this._afterNextRenderRef?.destroy(),this._previousHostParent=this._pane=this._host=this._backdropRef=null,a&&this._detachments.next(),this._detachments.complete(),this._completeDetachContent(),this._disposed=!0}hasAttached(){return this._portalOutlet.hasAttached()}backdropClick(){return this._backdropClick}attachments(){return this._attachments}detachments(){return this._detachments}keydownEvents(){return this._keydownEvents}outsidePointerEvents(){return this._outsidePointerEvents}getConfig(){return this._config}updatePosition(){this._positionStrategy&&this._positionStrategy.apply()}updatePositionStrategy(a){a!==this._positionStrategy&&(this._positionStrategy&&this._positionStrategy.dispose(),this._positionStrategy=a,this.hasAttached()&&(a.attach(this),this.updatePosition()))}updateSize(a){this._config=Ee(Ee({},this._config),a),this._updateElementSize()}setDirection(a){this._config=gn(Ee({},this._config),{direction:a}),this._updateElementDirection()}addPanelClass(a){this._pane&&this._toggleClasses(this._pane,a,!0)}removePanelClass(a){this._pane&&this._toggleClasses(this._pane,a,!1)}getDirection(){let a=this._config.direction;return a?typeof a=="string"?a:a.value:"ltr"}updateScrollStrategy(a){a!==this._scrollStrategy&&(this._disposeScrollStrategy(),this._scrollStrategy=a,this.hasAttached()&&(a.attach(this),a.enable()))}_updateElementDirection(){this._host.setAttribute("dir",this.getDirection())}_updateElementSize(){if(!this._pane)return;let a=this._pane.style;a.width=Y(this._config.width),a.height=Y(this._config.height),a.minWidth=Y(this._config.minWidth),a.minHeight=Y(this._config.minHeight),a.maxWidth=Y(this._config.maxWidth),a.maxHeight=Y(this._config.maxHeight)}_togglePointerEvents(a){this._pane.style.pointerEvents=a?"":"none"}_attachHost(){if(!this._host.parentElement){let a=this._config.usePopover?this._positionStrategy?.getPopoverInsertionPoint?.():null;Qi(a)?a.after(this._host):a?.type==="parent"?a.element.appendChild(this._host):this._previousHostParent?.appendChild(this._host)}if(this._config.usePopover)try{this._host.showPopover()}catch{}}_attachBackdrop(){let a="cdk-overlay-backdrop-showing";this._backdropRef?.dispose(),this._backdropRef=new Gi(this._document,this._renderer,this._ngZone,e=>{this._backdropClick.next(e)}),this._animationsDisabled&&this._backdropRef.element.classList.add("cdk-overlay-backdrop-noop-animation"),this._config.backdropClass&&this._toggleClasses(this._backdropRef.element,this._config.backdropClass,!0),this._config.usePopover?this._host.prepend(this._backdropRef.element):this._host.parentElement.insertBefore(this._backdropRef.element,this._host),!this._animationsDisabled&&typeof requestAnimationFrame<"u"?this._ngZone.runOutsideAngular(()=>{requestAnimationFrame(()=>this._backdropRef?.element.classList.add(a))}):this._backdropRef.element.classList.add(a)}_updateStackingOrder(){!this._config.usePopover&&this._host.nextSibling&&this._host.parentNode.appendChild(this._host)}detachBackdrop(){this._animationsDisabled?(this._backdropRef?.dispose(),this._backdropRef=null):this._backdropRef?.detach()}_toggleClasses(a,e,t){let i=Li(e||[]).filter(r=>!!r);i.length&&(t?a.classList.add(...i):a.classList.remove(...i))}_detachContentWhenEmpty(){let a=!1;try{this._detachContentAfterRenderRef=fe(()=>{a=!0,this._detachContent()},{injector:this._injector})}catch(e){if(a)throw e;this._detachContent()}globalThis.MutationObserver&&this._pane&&(this._detachContentMutationObserver||=new globalThis.MutationObserver(()=>{this._detachContent()}),this._detachContentMutationObserver.observe(this._pane,{childList:!0}))}_detachContent(){(!this._pane||!this._host||this._pane.children.length===0)&&(this._pane&&this._config.panelClass&&this._toggleClasses(this._pane,this._config.panelClass,!1),this._host&&this._host.parentElement&&(this._previousHostParent=this._host.parentElement,this._host.remove()),this._completeDetachContent())}_completeDetachContent(){this._detachContentAfterRenderRef?.destroy(),this._detachContentAfterRenderRef=void 0,this._detachContentMutationObserver?.disconnect()}_disposeScrollStrategy(){let a=this._scrollStrategy;a?.disable(),a?.detach?.()}},ha="cdk-overlay-connected-position-bounding-box",Fr=/([A-Za-z%]+)$/;function Le(n,a){return new _t(a,n.get(ht),n.get(ne),n.get(Q),n.get(wa))}var _t=class{_viewportRuler;_document;_platform;_overlayContainer;_overlayRef;_isInitialRender=!1;_lastBoundingBoxSize={width:0,height:0};_isPushed=!1;_canPush=!0;_growAfterOpen=!1;_hasFlexibleDimensions=!0;_positionLocked=!1;_originRect;_overlayRect;_viewportRect;_containerRect;_viewportMargin=0;_scrollables=[];_preferredPositions=[];_origin;_pane;_isDisposed=!1;_boundingBox=null;_lastPosition=null;_lastScrollVisibility=null;_positionChanges=new A;_resizeSubscription=B.EMPTY;_offsetX=0;_offsetY=0;_transformOriginSelector;_appliedPanelClasses=[];_previousPushAmount=null;_popoverLocation="global";positionChanges=this._positionChanges;get positions(){return this._preferredPositions}constructor(a,e,t,i,r){this._viewportRuler=e,this._document=t,this._platform=i,this._overlayContainer=r,this.setOrigin(a)}attach(a){this._overlayRef&&this._overlayRef,this._validatePositions(),a.hostElement.classList.add(ha),this._overlayRef=a,this._boundingBox=a.hostElement,this._pane=a.overlayElement,this._isDisposed=!1,this._isInitialRender=!0,this._lastPosition=null,this._resizeSubscription.unsubscribe(),this._resizeSubscription=this._viewportRuler.change().subscribe(()=>{this._isInitialRender=!0,this.apply()})}apply(){if(this._isDisposed||!this._platform.isBrowser)return;if(!this._isInitialRender&&this._positionLocked&&this._lastPosition){this.reapplyLastPosition();return}this._clearPanelClasses(),this._resetOverlayElementStyles(),this._resetBoundingBoxStyles(),this._viewportRect=this._getNarrowedViewportRect(),this._originRect=this._getOriginRect(),this._overlayRect=this._pane.getBoundingClientRect(),this._containerRect=this._getContainerRect();let a=this._originRect,e=this._overlayRect,t=this._viewportRect,i=this._containerRect,r=[],o;for(let p of this._preferredPositions){let f=this._getOriginPoint(a,i,p),y=this._getOverlayPoint(f,e,p),v=this._getOverlayFit(y,e,t,p);if(v.isCompletelyWithinViewport){this._isPushed=!1,this._applyPosition(p,f);return}if(this._canFitWithFlexibleDimensions(v,y,t)){r.push({position:p,origin:f,overlayRect:e,boundingBoxRect:this._calculateBoundingBoxRect(f,p)});continue}(!o||o.overlayFit.visibleArea<v.visibleArea)&&(o={overlayFit:v,overlayPoint:y,originPoint:f,position:p,overlayRect:e})}if(r.length){let p=null,f=-1;for(let y of r){let v=y.boundingBoxRect.width*y.boundingBoxRect.height*(y.position.weight||1);v>f&&(f=v,p=y)}this._isPushed=!1,this._applyPosition(p.position,p.origin);return}if(this._canPush){this._isPushed=!0,this._applyPosition(o.position,o.originPoint);return}this._applyPosition(o.position,o.originPoint)}detach(){this._clearPanelClasses(),this._lastPosition=null,this._previousPushAmount=null,this._resizeSubscription.unsubscribe()}dispose(){this._isDisposed||(this._boundingBox&&at(this._boundingBox.style,{top:"",left:"",right:"",bottom:"",height:"",width:"",alignItems:"",justifyContent:""}),this._pane&&this._resetOverlayElementStyles(),this._overlayRef&&this._overlayRef.hostElement.classList.remove(ha),this.detach(),this._positionChanges.complete(),this._overlayRef=this._boundingBox=null,this._isDisposed=!0)}reapplyLastPosition(){if(this._isDisposed||!this._platform.isBrowser)return;let a=this._lastPosition;a?(this._originRect=this._getOriginRect(),this._overlayRect=this._pane.getBoundingClientRect(),this._viewportRect=this._getNarrowedViewportRect(),this._containerRect=this._getContainerRect(),this._applyPosition(a,this._getOriginPoint(this._originRect,this._containerRect,a))):this.apply()}withScrollableContainers(a){return this._scrollables=a,this}withPositions(a){return this._preferredPositions=a,a.indexOf(this._lastPosition)===-1&&(this._lastPosition=null),this._validatePositions(),this}withViewportMargin(a){return this._viewportMargin=a,this}withFlexibleDimensions(a=!0){return this._hasFlexibleDimensions=a,this}withGrowAfterOpen(a=!0){return this._growAfterOpen=a,this}withPush(a=!0){return this._canPush=a,this}withLockedPosition(a=!0){return this._positionLocked=a,this}setOrigin(a){return this._origin=a,this}withDefaultOffsetX(a){return this._offsetX=a,this}withDefaultOffsetY(a){return this._offsetY=a,this}withTransformOriginOn(a){return this._transformOriginSelector=a,this}withPopoverLocation(a){return this._popoverLocation=a,this}getPopoverInsertionPoint(){return this._popoverLocation==="global"?null:this._popoverLocation!=="inline"?this._popoverLocation:this._origin instanceof O?this._origin.nativeElement:Qi(this._origin)?this._origin:null}_getOriginPoint(a,e,t){let i;if(t.originX=="center")i=a.left+a.width/2;else{let o=this._isRtl()?a.right:a.left,p=this._isRtl()?a.left:a.right;i=t.originX=="start"?o:p}e.left<0&&(i-=e.left);let r;return t.originY=="center"?r=a.top+a.height/2:r=t.originY=="top"?a.top:a.bottom,e.top<0&&(r-=e.top),{x:i,y:r}}_getOverlayPoint(a,e,t){let i;t.overlayX=="center"?i=-e.width/2:t.overlayX==="start"?i=this._isRtl()?-e.width:0:i=this._isRtl()?0:-e.width;let r;return t.overlayY=="center"?r=-e.height/2:r=t.overlayY=="top"?0:-e.height,{x:a.x+i,y:a.y+r}}_getOverlayFit(a,e,t,i){let r=fa(e),{x:o,y:p}=a,f=this._getOffset(i,"x"),y=this._getOffset(i,"y");f&&(o+=f),y&&(p+=y);let v=0-o,S=o+r.width-t.width,te=0-p,le=p+r.height-t.height,ie=this._subtractOverflows(r.width,v,S),_e=this._subtractOverflows(r.height,te,le),fn=ie*_e;return{visibleArea:fn,isCompletelyWithinViewport:r.width*r.height===fn,fitsInViewportVertically:_e===r.height,fitsInViewportHorizontally:ie==r.width}}_canFitWithFlexibleDimensions(a,e,t){if(this._hasFlexibleDimensions){let i=t.bottom-e.y,r=t.right-e.x,o=_a(this._overlayRef.getConfig().minHeight),p=_a(this._overlayRef.getConfig().minWidth),f=a.fitsInViewportVertically||o!=null&&o<=i,y=a.fitsInViewportHorizontally||p!=null&&p<=r;return f&&y}return!1}_pushOverlayOnScreen(a,e,t){if(this._previousPushAmount&&this._positionLocked)return{x:a.x+this._previousPushAmount.x,y:a.y+this._previousPushAmount.y};let i=fa(e),r=this._viewportRect,o=Math.max(a.x+i.width-r.width,0),p=Math.max(a.y+i.height-r.height,0),f=Math.max(r.top-t.top-a.y,0),y=Math.max(r.left-t.left-a.x,0),v=0,S=0;return i.width<=r.width?v=y||-o:v=a.x<this._getViewportMarginStart()?r.left-t.left-a.x:0,i.height<=r.height?S=f||-p:S=a.y<this._getViewportMarginTop()?r.top-t.top-a.y:0,this._previousPushAmount={x:v,y:S},{x:a.x+v,y:a.y+S}}_applyPosition(a,e){if(this._setTransformOrigin(a),this._setOverlayElementStyles(e,a),this._setBoundingBoxStyles(e,a),a.panelClass&&this._addPanelClasses(a.panelClass),this._positionChanges.observers.length){let t=this._getScrollVisibility();if(a!==this._lastPosition||!this._lastScrollVisibility||!Lr(this._lastScrollVisibility,t)){let i=new gi(a,t);this._positionChanges.next(i)}this._lastScrollVisibility=t}this._lastPosition=a,this._isInitialRender=!1}_setTransformOrigin(a){if(!this._transformOriginSelector)return;let e=this._boundingBox.querySelectorAll(this._transformOriginSelector),t,i=a.overlayY;a.overlayX==="center"?t="center":this._isRtl()?t=a.overlayX==="start"?"right":"left":t=a.overlayX==="start"?"left":"right";for(let r=0;r<e.length;r++)e[r].style.transformOrigin=`${t} ${i}`}_calculateBoundingBoxRect(a,e){let t=this._viewportRect,i=this._isRtl(),r,o,p;if(e.overlayY==="top")o=a.y,r=t.height-o+this._getViewportMarginBottom();else if(e.overlayY==="bottom")p=t.height-a.y+this._getViewportMarginTop()+this._getViewportMarginBottom(),r=t.height-p+this._getViewportMarginTop();else{let le=Math.min(t.bottom-a.y+t.top,a.y),ie=this._lastBoundingBoxSize.height;r=le*2,o=a.y-le,r>ie&&!this._isInitialRender&&!this._growAfterOpen&&(o=a.y-ie/2)}let f=e.overlayX==="start"&&!i||e.overlayX==="end"&&i,y=e.overlayX==="end"&&!i||e.overlayX==="start"&&i,v,S,te;if(y)te=t.width-a.x+this._getViewportMarginStart()+this._getViewportMarginEnd(),v=a.x-this._getViewportMarginStart();else if(f)S=a.x,v=t.right-a.x-this._getViewportMarginEnd();else{let le=Math.min(t.right-a.x+t.left,a.x),ie=this._lastBoundingBoxSize.width;v=le*2,S=a.x-le,v>ie&&!this._isInitialRender&&!this._growAfterOpen&&(S=a.x-ie/2)}return{top:o,left:S,bottom:p,right:te,width:v,height:r}}_setBoundingBoxStyles(a,e){let t=this._calculateBoundingBoxRect(a,e);!this._isInitialRender&&!this._growAfterOpen&&(t.height=Math.min(t.height,this._lastBoundingBoxSize.height),t.width=Math.min(t.width,this._lastBoundingBoxSize.width));let i={};if(this._hasExactPosition())i.top=i.left="0",i.bottom=i.right="auto",i.maxHeight=i.maxWidth="",i.width=i.height="100%";else{let r=this._overlayRef.getConfig().maxHeight,o=this._overlayRef.getConfig().maxWidth;i.width=Y(t.width),i.height=Y(t.height),i.top=Y(t.top)||"auto",i.bottom=Y(t.bottom)||"auto",i.left=Y(t.left)||"auto",i.right=Y(t.right)||"auto",e.overlayX==="center"?i.alignItems="center":i.alignItems=e.overlayX==="end"?"flex-end":"flex-start",e.overlayY==="center"?i.justifyContent="center":i.justifyContent=e.overlayY==="bottom"?"flex-end":"flex-start",r&&(i.maxHeight=Y(r)),o&&(i.maxWidth=Y(o))}this._lastBoundingBoxSize=t,at(this._boundingBox.style,i)}_resetBoundingBoxStyles(){at(this._boundingBox.style,{top:"0",left:"0",right:"0",bottom:"0",height:"",width:"",alignItems:"",justifyContent:""})}_resetOverlayElementStyles(){at(this._pane.style,{top:"",left:"",bottom:"",right:"",position:"",transform:""})}_setOverlayElementStyles(a,e){let t={},i=this._hasExactPosition(),r=this._hasFlexibleDimensions,o=this._overlayRef.getConfig();if(i){let v=this._viewportRuler.getViewportScrollPosition();at(t,this._getExactOverlayY(e,a,v)),at(t,this._getExactOverlayX(e,a,v))}else t.position="static";let p="",f=this._getOffset(e,"x"),y=this._getOffset(e,"y");f&&(p+=`translateX(${f}px) `),y&&(p+=`translateY(${y}px)`),t.transform=p.trim(),o.maxHeight&&(i?t.maxHeight=Y(o.maxHeight):r&&(t.maxHeight="")),o.maxWidth&&(i?t.maxWidth=Y(o.maxWidth):r&&(t.maxWidth="")),at(this._pane.style,t)}_getExactOverlayY(a,e,t){let i={top:"",bottom:""},r=this._getOverlayPoint(e,this._overlayRect,a);if(this._isPushed&&(r=this._pushOverlayOnScreen(r,this._overlayRect,t)),a.overlayY==="bottom"){let o=this._document.documentElement.clientHeight;i.bottom=`${o-(r.y+this._overlayRect.height)}px`}else i.top=Y(r.y);return i}_getExactOverlayX(a,e,t){let i={left:"",right:""},r=this._getOverlayPoint(e,this._overlayRect,a);this._isPushed&&(r=this._pushOverlayOnScreen(r,this._overlayRect,t));let o;if(this._isRtl()?o=a.overlayX==="end"?"left":"right":o=a.overlayX==="end"?"right":"left",o==="right"){let p=this._document.documentElement.clientWidth;i.right=`${p-(r.x+this._overlayRect.width)}px`}else i.left=Y(r.x);return i}_getScrollVisibility(){let a=this._getOriginRect(),e=this._pane.getBoundingClientRect(),t=this._scrollables.map(i=>i.getElementRef().nativeElement.getBoundingClientRect());return{isOriginClipped:ua(a,t),isOriginOutsideView:Ui(a,t),isOverlayClipped:ua(e,t),isOverlayOutsideView:Ui(e,t)}}_subtractOverflows(a,...e){return e.reduce((t,i)=>t-Math.max(i,0),a)}_getNarrowedViewportRect(){let a=this._document.documentElement.clientWidth,e=this._document.documentElement.clientHeight,t=this._viewportRuler.getViewportScrollPosition();return{top:t.top+this._getViewportMarginTop(),left:t.left+this._getViewportMarginStart(),right:t.left+a-this._getViewportMarginEnd(),bottom:t.top+e-this._getViewportMarginBottom(),width:a-this._getViewportMarginStart()-this._getViewportMarginEnd(),height:e-this._getViewportMarginTop()-this._getViewportMarginBottom()}}_isRtl(){return this._overlayRef.getDirection()==="rtl"}_hasExactPosition(){return!this._hasFlexibleDimensions||this._isPushed}_getOffset(a,e){return e==="x"?a.offsetX==null?this._offsetX:a.offsetX:a.offsetY==null?this._offsetY:a.offsetY}_validatePositions(){}_addPanelClasses(a){this._pane&&Li(a).forEach(e=>{e!==""&&this._appliedPanelClasses.indexOf(e)===-1&&(this._appliedPanelClasses.push(e),this._pane.classList.add(e))})}_clearPanelClasses(){this._pane&&(this._appliedPanelClasses.forEach(a=>{this._pane.classList.remove(a)}),this._appliedPanelClasses=[])}_getViewportMarginStart(){return typeof this._viewportMargin=="number"?this._viewportMargin:this._viewportMargin?.start??0}_getViewportMarginEnd(){return typeof this._viewportMargin=="number"?this._viewportMargin:this._viewportMargin?.end??0}_getViewportMarginTop(){return typeof this._viewportMargin=="number"?this._viewportMargin:this._viewportMargin?.top??0}_getViewportMarginBottom(){return typeof this._viewportMargin=="number"?this._viewportMargin:this._viewportMargin?.bottom??0}_getOriginRect(){let a=this._origin;if(a instanceof O)return a.nativeElement.getBoundingClientRect();if(a instanceof Element)return a.getBoundingClientRect();let e=a.width||0,t=a.height||0;return{top:a.y,bottom:a.y+t,left:a.x,right:a.x+e,height:t,width:e}}_getContainerRect(){let a=this._overlayRef.getConfig().usePopover&&this._popoverLocation!=="global",e=this._overlayContainer.getContainerElement();a&&(e.style.display="block");let t=e.getBoundingClientRect();return a&&(e.style.display=""),t}};function at(n,a){for(let e in a)a.hasOwnProperty(e)&&(n[e]=a[e]);return n}function _a(n){if(typeof n!="number"&&n!=null){let[a,e]=n.split(Fr);return!e||e==="px"?parseFloat(a):null}return n||null}function fa(n){return{top:Math.floor(n.top),right:Math.floor(n.right),bottom:Math.floor(n.bottom),left:Math.floor(n.left),width:Math.floor(n.width),height:Math.floor(n.height)}}function Lr(n,a){return n===a?!0:n.isOriginClipped===a.isOriginClipped&&n.isOriginOutsideView===a.isOriginOutsideView&&n.isOverlayClipped===a.isOverlayClipped&&n.isOverlayOutsideView===a.isOverlayOutsideView}var ga="cdk-global-overlay-wrapper";function Ci(n){return new vi}var vi=class{_overlayRef;_cssPosition="static";_topOffset="";_bottomOffset="";_alignItems="";_xPosition="";_xOffset="";_width="";_height="";_isDisposed=!1;attach(a){let e=a.getConfig();this._overlayRef=a,this._width&&!e.width&&a.updateSize({width:this._width}),this._height&&!e.height&&a.updateSize({height:this._height}),a.hostElement.classList.add(ga),this._isDisposed=!1}top(a=""){return this._bottomOffset="",this._topOffset=a,this._alignItems="flex-start",this}left(a=""){return this._xOffset=a,this._xPosition="left",this}bottom(a=""){return this._topOffset="",this._bottomOffset=a,this._alignItems="flex-end",this}right(a=""){return this._xOffset=a,this._xPosition="right",this}start(a=""){return this._xOffset=a,this._xPosition="start",this}end(a=""){return this._xOffset=a,this._xPosition="end",this}width(a=""){return this._overlayRef?this._overlayRef.updateSize({width:a}):this._width=a,this}height(a=""){return this._overlayRef?this._overlayRef.updateSize({height:a}):this._height=a,this}centerHorizontally(a=""){return this.left(a),this._xPosition="center",this}centerVertically(a=""){return this.top(a),this._alignItems="center",this}apply(){if(!this._overlayRef||!this._overlayRef.hasAttached())return;let a=this._overlayRef.overlayElement.style,e=this._overlayRef.hostElement.style,t=this._overlayRef.getConfig(),{width:i,height:r,maxWidth:o,maxHeight:p}=t,f=(i==="100%"||i==="100vw")&&(!o||o==="100%"||o==="100vw"),y=(r==="100%"||r==="100vh")&&(!p||p==="100%"||p==="100vh"),v=this._xPosition,S=this._xOffset,te=this._overlayRef.getConfig().direction==="rtl",le="",ie="",_e="";f?_e="flex-start":v==="center"?(_e="center",te?ie=S:le=S):te?v==="left"||v==="end"?(_e="flex-end",le=S):(v==="right"||v==="start")&&(_e="flex-start",ie=S):v==="left"||v==="start"?(_e="flex-start",le=S):(v==="right"||v==="end")&&(_e="flex-end",ie=S),a.position=this._cssPosition,a.marginLeft=f?"0":le,a.marginTop=y?"0":this._topOffset,a.marginBottom=this._bottomOffset,a.marginRight=f?"0":ie,e.justifyContent=_e,e.alignItems=y?"flex-start":this._alignItems}dispose(){if(this._isDisposed||!this._overlayRef)return;let a=this._overlayRef.overlayElement.style,e=this._overlayRef.hostElement,t=e.style;e.classList.remove(ga),t.justifyContent=t.alignItems=a.marginTop=a.marginBottom=a.marginLeft=a.marginRight=a.position="",this._overlayRef=null,this._isDisposed=!0}},ka=(()=>{class n{_injector=s(j);constructor(){}global(){return Ci()}flexibleConnectedTo(e){return Le(this._injector,e)}static \u0275fac=function(t){return new(t||n)};static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})(),Ji=new N("OVERLAY_DEFAULT_CONFIG");function Ne(n,a){n.get(Me).load(Da);let e=n.get(wa),t=n.get(ne),i=n.get(ce),r=n.get(Vi),o=n.get(se),p=n.get(ae,null,{optional:!0})||n.get(Oe).createRenderer(null,null),f=new rt(a),y=n.get(Ji,null,{optional:!0})?.usePopover??!0;f.direction=f.direction||o.value,"showPopover"in t.body?f.usePopover=a?.usePopover??y:f.usePopover=!1;let v=t.createElement("div"),S=t.createElement("div");v.id=i.getId("cdk-overlay-"),v.classList.add("cdk-overlay-pane"),S.appendChild(v),f.usePopover&&(S.setAttribute("popover","manual"),S.classList.add("cdk-overlay-popover"));let te=f.usePopover?f.positionStrategy?.getPopoverInsertionPoint?.():null;return Qi(te)?te.after(S):te?.type==="parent"?te.element.appendChild(S):e.getContainerElement().appendChild(S),new bi(new ui(v,r,n),S,v,f,n.get(L),n.get(Ca),t,n.get(Rn),n.get(xa),a?.disableAnimations??n.get(xn,null,{optional:!0})==="NoopAnimations",n.get(Bt),p)}var Ma=(()=>{class n{scrollStrategies=s(va);_positionBuilder=s(ka);_injector=s(j);constructor(){}create(e){return Ne(this._injector,e)}position(){return this._positionBuilder}static \u0275fac=function(t){return new(t||n)};static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})(),Nr=[{originX:"start",originY:"bottom",overlayX:"start",overlayY:"top"},{originX:"start",originY:"top",overlayX:"start",overlayY:"bottom"},{originX:"end",originY:"top",overlayX:"end",overlayY:"bottom"},{originX:"end",originY:"bottom",overlayX:"end",overlayY:"top"}],Br=new N("cdk-connected-overlay-scroll-strategy",{providedIn:"root",factory:()=>{let n=s(j);return()=>Fe(n)}}),Zi=(()=>{class n{elementRef=s(O);constructor(){}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["","cdk-overlay-origin",""],["","overlay-origin",""],["","cdkOverlayOrigin",""]],exportAs:["cdkOverlayOrigin"]})}return n})(),Sa=new N("cdk-connected-overlay-default-config"),zr=(()=>{class n{_dir=s(se,{optional:!0});_injector=s(j);_overlayRef;_templatePortal;_backdropSubscription=B.EMPTY;_attachSubscription=B.EMPTY;_detachSubscription=B.EMPTY;_positionSubscription=B.EMPTY;_offsetX;_offsetY;_position;_scrollStrategyFactory=s(Br);_ngZone=s(L);origin;positions;positionStrategy;get offsetX(){return this._offsetX}set offsetX(e){this._offsetX=e,this._position&&this._updatePositionStrategy(this._position)}get offsetY(){return this._offsetY}set offsetY(e){this._offsetY=e,this._position&&this._updatePositionStrategy(this._position)}width;height;minWidth;minHeight;backdropClass;panelClass;viewportMargin=0;scrollStrategy;open=!1;disableClose=!1;transformOriginSelector;hasBackdrop=!1;lockPosition=!1;flexibleDimensions=!1;growAfterOpen=!1;push=!1;disposeOnNavigation=!1;usePopover;matchWidth=!1;set _config(e){typeof e!="string"&&this._assignConfig(e)}backdropClick=new D;positionChange=new D;attach=new D;detach=new D;overlayKeydown=new D;overlayOutsideClick=new D;constructor(){let e=s(wt),t=s(ve),i=s(Sa,{optional:!0}),r=s(Ji,{optional:!0});this.usePopover=r?.usePopover===!1?null:"global",this._templatePortal=new Xe(e,t),this.scrollStrategy=this._scrollStrategyFactory(),i&&this._assignConfig(i)}get overlayRef(){return this._overlayRef}get dir(){return this._dir?this._dir.value:"ltr"}ngOnDestroy(){this._attachSubscription.unsubscribe(),this._detachSubscription.unsubscribe(),this._backdropSubscription.unsubscribe(),this._positionSubscription.unsubscribe(),this._overlayRef?.dispose()}ngOnChanges(e){this._position&&(this._updatePositionStrategy(this._position),this._overlayRef?.updateSize({width:this._getWidth(),minWidth:this.minWidth,height:this.height,minHeight:this.minHeight}),e.origin&&this.open&&this._position.apply()),e.open&&(this.open?this.attachOverlay():this.detachOverlay())}_createOverlay(){(!this.positions||!this.positions.length)&&(this.positions=Nr);let e=this._overlayRef=Ne(this._injector,this._buildConfig());this._attachSubscription=e.attachments().subscribe(()=>this.attach.emit()),this._detachSubscription=e.detachments().subscribe(()=>this.detach.emit()),e.keydownEvents().subscribe(t=>{this.overlayKeydown.next(t),t.keyCode===27&&!this.disableClose&&!de(t)&&(t.preventDefault(),this.detachOverlay())}),this._overlayRef.outsidePointerEvents().subscribe(t=>{let i=this._getOriginElement(),r=it(t);(!i||i!==r&&!i.contains(r))&&this.overlayOutsideClick.next(t)})}_buildConfig(){let e=this._position=this.positionStrategy||this._createPositionStrategy(),t=new rt({direction:this._dir||"ltr",positionStrategy:e,scrollStrategy:this.scrollStrategy,hasBackdrop:this.hasBackdrop,disposeOnNavigation:this.disposeOnNavigation,usePopover:!!this.usePopover});return(this.height||this.height===0)&&(t.height=this.height),(this.minWidth||this.minWidth===0)&&(t.minWidth=this.minWidth),(this.minHeight||this.minHeight===0)&&(t.minHeight=this.minHeight),this.backdropClass&&(t.backdropClass=this.backdropClass),this.panelClass&&(t.panelClass=this.panelClass),t}_updatePositionStrategy(e){let t=this.positions.map(i=>({originX:i.originX,originY:i.originY,overlayX:i.overlayX,overlayY:i.overlayY,offsetX:i.offsetX||this.offsetX,offsetY:i.offsetY||this.offsetY,panelClass:i.panelClass||void 0}));return e.setOrigin(this._getOrigin()).withPositions(t).withFlexibleDimensions(this.flexibleDimensions).withPush(this.push).withGrowAfterOpen(this.growAfterOpen).withViewportMargin(this.viewportMargin).withLockedPosition(this.lockPosition).withTransformOriginOn(this.transformOriginSelector).withPopoverLocation(this.usePopover===null?"global":this.usePopover)}_createPositionStrategy(){let e=Le(this._injector,this._getOrigin());return this._updatePositionStrategy(e),e}_getOrigin(){return this.origin instanceof Zi?this.origin.elementRef:this.origin}_getOriginElement(){return this.origin instanceof Zi?this.origin.elementRef.nativeElement:this.origin instanceof O?this.origin.nativeElement:typeof Element<"u"&&this.origin instanceof Element?this.origin:null}_getWidth(){return this.width?this.width:this.matchWidth?this._getOriginElement()?.getBoundingClientRect?.().width:void 0}attachOverlay(){this._overlayRef||this._createOverlay();let e=this._overlayRef;e.getConfig().hasBackdrop=this.hasBackdrop,e.updateSize({width:this._getWidth()}),e.hasAttached()||e.attach(this._templatePortal),this.hasBackdrop?this._backdropSubscription=e.backdropClick().subscribe(t=>this.backdropClick.emit(t)):this._backdropSubscription.unsubscribe(),this._positionSubscription.unsubscribe(),this.positionChange.observers.length>0&&(this._positionSubscription=this._position.positionChanges.pipe(Cn(()=>this.positionChange.observers.length>0)).subscribe(t=>{this._ngZone.run(()=>this.positionChange.emit(t)),this.positionChange.observers.length===0&&this._positionSubscription.unsubscribe()})),this.open=!0}detachOverlay(){this._overlayRef?.detach(),this._backdropSubscription.unsubscribe(),this._positionSubscription.unsubscribe(),this.open=!1}_assignConfig(e){this.origin=e.origin??this.origin,this.positions=e.positions??this.positions,this.positionStrategy=e.positionStrategy??this.positionStrategy,this.offsetX=e.offsetX??this.offsetX,this.offsetY=e.offsetY??this.offsetY,this.width=e.width??this.width,this.height=e.height??this.height,this.minWidth=e.minWidth??this.minWidth,this.minHeight=e.minHeight??this.minHeight,this.backdropClass=e.backdropClass??this.backdropClass,this.panelClass=e.panelClass??this.panelClass,this.viewportMargin=e.viewportMargin??this.viewportMargin,this.scrollStrategy=e.scrollStrategy??this.scrollStrategy,this.disableClose=e.disableClose??this.disableClose,this.transformOriginSelector=e.transformOriginSelector??this.transformOriginSelector,this.hasBackdrop=e.hasBackdrop??this.hasBackdrop,this.lockPosition=e.lockPosition??this.lockPosition,this.flexibleDimensions=e.flexibleDimensions??this.flexibleDimensions,this.growAfterOpen=e.growAfterOpen??this.growAfterOpen,this.push=e.push??this.push,this.disposeOnNavigation=e.disposeOnNavigation??this.disposeOnNavigation,this.usePopover=e.usePopover??this.usePopover,this.matchWidth=e.matchWidth??this.matchWidth}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["","cdk-connected-overlay",""],["","connected-overlay",""],["","cdkConnectedOverlay",""]],inputs:{origin:[0,"cdkConnectedOverlayOrigin","origin"],positions:[0,"cdkConnectedOverlayPositions","positions"],positionStrategy:[0,"cdkConnectedOverlayPositionStrategy","positionStrategy"],offsetX:[0,"cdkConnectedOverlayOffsetX","offsetX"],offsetY:[0,"cdkConnectedOverlayOffsetY","offsetY"],width:[0,"cdkConnectedOverlayWidth","width"],height:[0,"cdkConnectedOverlayHeight","height"],minWidth:[0,"cdkConnectedOverlayMinWidth","minWidth"],minHeight:[0,"cdkConnectedOverlayMinHeight","minHeight"],backdropClass:[0,"cdkConnectedOverlayBackdropClass","backdropClass"],panelClass:[0,"cdkConnectedOverlayPanelClass","panelClass"],viewportMargin:[0,"cdkConnectedOverlayViewportMargin","viewportMargin"],scrollStrategy:[0,"cdkConnectedOverlayScrollStrategy","scrollStrategy"],open:[0,"cdkConnectedOverlayOpen","open"],disableClose:[0,"cdkConnectedOverlayDisableClose","disableClose"],transformOriginSelector:[0,"cdkConnectedOverlayTransformOriginOn","transformOriginSelector"],hasBackdrop:[2,"cdkConnectedOverlayHasBackdrop","hasBackdrop",F],lockPosition:[2,"cdkConnectedOverlayLockPosition","lockPosition",F],flexibleDimensions:[2,"cdkConnectedOverlayFlexibleDimensions","flexibleDimensions",F],growAfterOpen:[2,"cdkConnectedOverlayGrowAfterOpen","growAfterOpen",F],push:[2,"cdkConnectedOverlayPush","push",F],disposeOnNavigation:[2,"cdkConnectedOverlayDisposeOnNavigation","disposeOnNavigation",F],usePopover:[0,"cdkConnectedOverlayUsePopover","usePopover"],matchWidth:[2,"cdkConnectedOverlayMatchWidth","matchWidth",F],_config:[0,"cdkConnectedOverlay","_config"]},outputs:{backdropClick:"backdropClick",positionChange:"positionChange",attach:"attach",detach:"detach",overlayKeydown:"overlayKeydown",overlayOutsideClick:"overlayOutsideClick"},exportAs:["cdkConnectedOverlay"],features:[ue]})}return n})(),en=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=G({type:n});static \u0275inj=U({providers:[Ma],imports:[De,mi,Xi,Xi]})}return n})();var Hr=["tooltip"],Yr=20;var jr=new N("mat-tooltip-scroll-strategy",{providedIn:"root",factory:()=>{let n=s(j);return()=>Fe(n,{scrollThrottle:Yr})}}),Wr=new N("mat-tooltip-default-options",{providedIn:"root",factory:()=>({showDelay:0,hideDelay:0,touchendHideDelay:1500})});var Ea="tooltip-panel",qr={passive:!0},Xr=8,$r=8,Kr=24,Ur=200,Aa=(()=>{class n{_elementRef=s(O);_ngZone=s(L);_platform=s(Q);_ariaDescriber=s(qn);_focusMonitor=s(zn);_dir=s(se);_injector=s(j);_viewContainerRef=s(ve);_mediaMatcher=s(Bn);_document=s(ne);_renderer=s(ae);_animationsDisabled=Se();_defaultOptions=s(Wr,{optional:!0});_overlayRef=null;_tooltipInstance=null;_overlayPanelClass;_portal;_position="below";_positionAtOrigin=!1;_disabled=!1;_tooltipClass;_viewInitialized=!1;_pointerExitEventsInitialized=!1;_tooltipComponent=Gr;_viewportMargin=8;_currentPosition;_cssClassPrefix="mat-mdc";_ariaDescriptionPending=!1;_dirSubscribed=!1;get position(){return this._position}set position(e){e!==this._position&&(this._position=e,this._overlayRef&&(this._updatePosition(this._overlayRef),this._tooltipInstance?.show(0),this._overlayRef.updatePosition()))}get positionAtOrigin(){return this._positionAtOrigin}set positionAtOrigin(e){this._positionAtOrigin=Ve(e),this._detach(),this._overlayRef=null}get disabled(){return this._disabled}set disabled(e){let t=Ve(e);this._disabled!==t&&(this._disabled=t,t?this.hide(0):this._setupPointerEnterEventsIfNeeded(),this._syncAriaDescription(this.message))}get showDelay(){return this._showDelay}set showDelay(e){this._showDelay=Et(e)}_showDelay;get hideDelay(){return this._hideDelay}set hideDelay(e){this._hideDelay=Et(e),this._tooltipInstance&&(this._tooltipInstance._mouseLeaveHideDelay=this._hideDelay)}_hideDelay;touchGestures="auto";get message(){return this._message}set message(e){let t=this._message;this._message=e!=null?String(e).trim():"",!this._message&&this._isTooltipVisible()?this.hide(0):(this._setupPointerEnterEventsIfNeeded(),this._updateTooltipMessage()),this._syncAriaDescription(t)}_message="";get tooltipClass(){return this._tooltipClass}set tooltipClass(e){this._tooltipClass=e,this._tooltipInstance&&this._setTooltipClass(this._tooltipClass)}_eventCleanups=[];_touchstartTimeout=null;_destroyed=new A;_isDestroyed=!1;constructor(){let e=this._defaultOptions;e&&(this._showDelay=e.showDelay,this._hideDelay=e.hideDelay,e.position&&(this.position=e.position),e.positionAtOrigin&&(this.positionAtOrigin=e.positionAtOrigin),e.touchGestures&&(this.touchGestures=e.touchGestures),e.tooltipClass&&(this.tooltipClass=e.tooltipClass)),this._viewportMargin=Xr}ngAfterViewInit(){this._viewInitialized=!0,this._setupPointerEnterEventsIfNeeded(),this._focusMonitor.monitor(this._elementRef).pipe(pe(this._destroyed)).subscribe(e=>{e?e==="keyboard"&&this._ngZone.run(()=>this.show()):this._ngZone.run(()=>this.hide(0))})}ngOnDestroy(){let e=this._elementRef.nativeElement;this._touchstartTimeout&&clearTimeout(this._touchstartTimeout),this._overlayRef&&(this._overlayRef.dispose(),this._tooltipInstance=null),this._eventCleanups.forEach(t=>t()),this._eventCleanups.length=0,this._destroyed.next(),this._destroyed.complete(),this._isDestroyed=!0,this._ariaDescriber.removeDescription(e,this.message,"tooltip"),this._focusMonitor.stopMonitoring(e)}show(e=this.showDelay,t){if(this.disabled||!this.message||this._isTooltipVisible()){this._tooltipInstance?._cancelPendingAnimations();return}let i=this._createOverlay(t);this._detach(),this._portal=this._portal||new qe(this._tooltipComponent,this._viewContainerRef);let r=this._tooltipInstance=i.attach(this._portal).instance;r._triggerElement=this._elementRef.nativeElement,r._mouseLeaveHideDelay=this._hideDelay,r.afterHidden().pipe(pe(this._destroyed)).subscribe(()=>this._detach()),this._setTooltipClass(this._tooltipClass),this._updateTooltipMessage(),r.show(e)}hide(e=this.hideDelay){let t=this._tooltipInstance;t&&(t.isVisible()?t.hide(e):(t._cancelPendingAnimations(),this._detach()))}toggle(e){this._isTooltipVisible()?this.hide():this.show(void 0,e)}_isTooltipVisible(){return!!this._tooltipInstance&&this._tooltipInstance.isVisible()}_createOverlay(e){if(this._overlayRef){let o=this._overlayRef.getConfig().positionStrategy;if((!this.positionAtOrigin||!e)&&o._origin instanceof O)return this._overlayRef;this._detach()}let t=this._injector.get(mt).getAncestorScrollContainers(this._elementRef),i=`${this._cssClassPrefix}-${Ea}`,r=Le(this._injector,this.positionAtOrigin?e||this._elementRef:this._elementRef).withTransformOriginOn(`.${this._cssClassPrefix}-tooltip`).withFlexibleDimensions(!1).withViewportMargin(this._viewportMargin).withScrollableContainers(t).withPopoverLocation("global");return r.positionChanges.pipe(pe(this._destroyed)).subscribe(o=>{this._updateCurrentPositionClass(o.connectionPair),this._tooltipInstance&&o.scrollableViewProperties.isOverlayClipped&&this._tooltipInstance.isVisible()&&this._ngZone.run(()=>this.hide(0))}),this._overlayRef=Ne(this._injector,{direction:this._dir,positionStrategy:r,panelClass:this._overlayPanelClass?[...this._overlayPanelClass,i]:i,scrollStrategy:this._injector.get(jr)(),disableAnimations:this._animationsDisabled,eventPredicate:this._overlayEventPredicate}),this._updatePosition(this._overlayRef),this._overlayRef.detachments().pipe(pe(this._destroyed)).subscribe(()=>this._detach()),this._overlayRef.outsidePointerEvents().pipe(pe(this._destroyed)).subscribe(()=>this._tooltipInstance?._handleBodyInteraction()),this._overlayRef.keydownEvents().pipe(pe(this._destroyed)).subscribe(o=>{o.preventDefault(),o.stopPropagation(),this._ngZone.run(()=>this.hide(0))}),this._defaultOptions?.disableTooltipInteractivity&&this._overlayRef.addPanelClass(`${this._cssClassPrefix}-tooltip-panel-non-interactive`),this._dirSubscribed||(this._dirSubscribed=!0,this._dir.change.pipe(pe(this._destroyed)).subscribe(()=>{this._overlayRef&&this._updatePosition(this._overlayRef)})),this._overlayRef}_detach(){this._overlayRef&&this._overlayRef.hasAttached()&&this._overlayRef.detach(),this._tooltipInstance=null}_updatePosition(e){let t=e.getConfig().positionStrategy,i=this._getOrigin(),r=this._getOverlayPosition();t.withPositions([this._addOffset(Ee(Ee({},i.main),r.main)),this._addOffset(Ee(Ee({},i.fallback),r.fallback))])}_addOffset(e){let t=$r,i=!this._dir||this._dir.value=="ltr";return e.originY==="top"?e.offsetY=-t:e.originY==="bottom"?e.offsetY=t:e.originX==="start"?e.offsetX=i?-t:t:e.originX==="end"&&(e.offsetX=i?t:-t),e}_getOrigin(){let e=!this._dir||this._dir.value=="ltr",t=this.position,i;t=="above"||t=="below"?i={originX:"center",originY:t=="above"?"top":"bottom"}:t=="before"||t=="left"&&e||t=="right"&&!e?i={originX:"start",originY:"center"}:(t=="after"||t=="right"&&e||t=="left"&&!e)&&(i={originX:"end",originY:"center"});let{x:r,y:o}=this._invertPosition(i.originX,i.originY);return{main:i,fallback:{originX:r,originY:o}}}_getOverlayPosition(){let e=!this._dir||this._dir.value=="ltr",t=this.position,i;t=="above"?i={overlayX:"center",overlayY:"bottom"}:t=="below"?i={overlayX:"center",overlayY:"top"}:t=="before"||t=="left"&&e||t=="right"&&!e?i={overlayX:"end",overlayY:"center"}:(t=="after"||t=="right"&&e||t=="left"&&!e)&&(i={overlayX:"start",overlayY:"center"});let{x:r,y:o}=this._invertPosition(i.overlayX,i.overlayY);return{main:i,fallback:{overlayX:r,overlayY:o}}}_updateTooltipMessage(){this._tooltipInstance&&(this._tooltipInstance.message=this.message,this._tooltipInstance._markForCheck(),fe(()=>{this._tooltipInstance&&this._overlayRef.updatePosition()},{injector:this._injector}))}_setTooltipClass(e){this._tooltipInstance&&(this._tooltipInstance.tooltipClass=e instanceof Set?Array.from(e):e,this._tooltipInstance._markForCheck())}_invertPosition(e,t){return this.position==="above"||this.position==="below"?t==="top"?t="bottom":t==="bottom"&&(t="top"):e==="end"?e="start":e==="start"&&(e="end"),{x:e,y:t}}_updateCurrentPositionClass(e){let{overlayY:t,originX:i,originY:r}=e,o;if(t==="center"?this._dir&&this._dir.value==="rtl"?o=i==="end"?"left":"right":o=i==="start"?"left":"right":o=t==="bottom"&&r==="top"?"above":"below",o!==this._currentPosition){let p=this._overlayRef;if(p){let f=`${this._cssClassPrefix}-${Ea}-`;p.removePanelClass(f+this._currentPosition),p.addPanelClass(f+o)}this._currentPosition=o}}_setupPointerEnterEventsIfNeeded(){this._disabled||!this.message||!this._viewInitialized||this._eventCleanups.length||(this._isTouchPlatform()?this.touchGestures!=="off"&&(this._disableNativeGesturesIfNecessary(),this._addListener("touchstart",e=>{let t=e.targetTouches?.[0],i=t?{x:t.clientX,y:t.clientY}:void 0;this._setupPointerExitEventsIfNeeded(),this._touchstartTimeout&&clearTimeout(this._touchstartTimeout);let r=500;this._touchstartTimeout=setTimeout(()=>{this._touchstartTimeout=null,this.show(void 0,i)},this._defaultOptions?.touchLongPressShowDelay??r)})):this._addListener("mouseenter",e=>{this._setupPointerExitEventsIfNeeded();let t;e.x!==void 0&&e.y!==void 0&&(t=e),this.show(void 0,t)}))}_setupPointerExitEventsIfNeeded(){if(!this._pointerExitEventsInitialized){if(this._pointerExitEventsInitialized=!0,!this._isTouchPlatform())this._addListener("mouseleave",e=>{let t=e.relatedTarget;(!t||!this._overlayRef?.overlayElement.contains(t))&&this.hide()}),this._addListener("wheel",e=>{if(this._isTooltipVisible()){let t=this._document.elementFromPoint(e.clientX,e.clientY),i=this._elementRef.nativeElement;t!==i&&!i.contains(t)&&this.hide()}});else if(this.touchGestures!=="off"){this._disableNativeGesturesIfNecessary();let e=()=>{this._touchstartTimeout&&clearTimeout(this._touchstartTimeout),this.hide(this._defaultOptions?.touchendHideDelay)};this._addListener("touchend",e),this._addListener("touchcancel",e)}}}_addListener(e,t){this._eventCleanups.push(this._renderer.listen(this._elementRef.nativeElement,e,t,qr))}_isTouchPlatform(){let e=this._defaultOptions?.detectHoverCapability;return typeof e=="function"?!e():this._platform.IOS||this._platform.ANDROID?!0:this._platform.isBrowser?!!e&&this._mediaMatcher.matchMedia("(any-hover: none)").matches:!1}_disableNativeGesturesIfNecessary(){let e=this.touchGestures;if(e!=="off"){let t=this._elementRef.nativeElement,i=t.style;(e==="on"||t.nodeName!=="INPUT"&&t.nodeName!=="TEXTAREA")&&(i.userSelect=i.msUserSelect=i.webkitUserSelect=i.MozUserSelect="none"),(e==="on"||!t.draggable)&&(i.webkitUserDrag="none"),i.touchAction="none",i.webkitTapHighlightColor="transparent"}}_syncAriaDescription(e){this._ariaDescriptionPending||(this._ariaDescriptionPending=!0,this._ariaDescriber.removeDescription(this._elementRef.nativeElement,e,"tooltip"),this._isDestroyed||fe({write:()=>{this._ariaDescriptionPending=!1,this.message&&!this.disabled&&this._ariaDescriber.describe(this._elementRef.nativeElement,this.message,"tooltip")}},{injector:this._injector}))}_overlayEventPredicate=e=>e.type==="keydown"?this._isTooltipVisible()&&e.keyCode===27&&!de(e):!0;static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["","matTooltip",""]],hostAttrs:[1,"mat-mdc-tooltip-trigger"],hostVars:2,hostBindings:function(t,i){t&2&&k("mat-mdc-tooltip-disabled",i.disabled)},inputs:{position:[0,"matTooltipPosition","position"],positionAtOrigin:[0,"matTooltipPositionAtOrigin","positionAtOrigin"],disabled:[0,"matTooltipDisabled","disabled"],showDelay:[0,"matTooltipShowDelay","showDelay"],hideDelay:[0,"matTooltipHideDelay","hideDelay"],touchGestures:[0,"matTooltipTouchGestures","touchGestures"],message:[0,"matTooltip","message"],tooltipClass:[0,"matTooltipClass","tooltipClass"]},exportAs:["matTooltip"]})}return n})(),Gr=(()=>{class n{_changeDetectorRef=s(Z);_elementRef=s(O);_isMultiline=!1;message;tooltipClass;_showTimeoutId;_hideTimeoutId;_triggerElement;_mouseLeaveHideDelay;_animationsDisabled=Se();_tooltip;_closeOnInteraction=!1;_isVisible=!1;_onHide=new A;_showAnimation="mat-mdc-tooltip-show";_hideAnimation="mat-mdc-tooltip-hide";constructor(){}show(e){this._hideTimeoutId!=null&&clearTimeout(this._hideTimeoutId),this._showTimeoutId=setTimeout(()=>{this._toggleVisibility(!0),this._showTimeoutId=void 0},e)}hide(e){this._showTimeoutId!=null&&clearTimeout(this._showTimeoutId),this._hideTimeoutId=setTimeout(()=>{this._toggleVisibility(!1),this._hideTimeoutId=void 0},e)}afterHidden(){return this._onHide}isVisible(){return this._isVisible}ngOnDestroy(){this._cancelPendingAnimations(),this._onHide.complete(),this._triggerElement=null}_handleBodyInteraction(){this._closeOnInteraction&&this.hide(0)}_markForCheck(){this._changeDetectorRef.markForCheck()}_handleMouseLeave({relatedTarget:e}){(!e||!this._triggerElement.contains(e))&&(this.isVisible()?this.hide(this._mouseLeaveHideDelay):this._finalizeAnimation(!1))}_onShow(){this._isMultiline=this._isTooltipMultiline(),this._markForCheck()}_isTooltipMultiline(){let e=this._elementRef.nativeElement.getBoundingClientRect();return e.height>Kr&&e.width>=Ur}_handleAnimationEnd({animationName:e}){(e===this._showAnimation||e===this._hideAnimation)&&this._finalizeAnimation(e===this._showAnimation)}_cancelPendingAnimations(){this._showTimeoutId!=null&&clearTimeout(this._showTimeoutId),this._hideTimeoutId!=null&&clearTimeout(this._hideTimeoutId),this._showTimeoutId=this._hideTimeoutId=void 0}_finalizeAnimation(e){e?this._closeOnInteraction=!0:this.isVisible()||this._onHide.next()}_toggleVisibility(e){let t=this._tooltip.nativeElement,i=this._showAnimation,r=this._hideAnimation;if(t.classList.remove(e?r:i),t.classList.add(e?i:r),this._isVisible!==e&&(this._isVisible=e,this._changeDetectorRef.markForCheck()),e&&!this._animationsDisabled&&typeof getComputedStyle=="function"){let o=getComputedStyle(t);(o.getPropertyValue("animation-duration")==="0s"||o.getPropertyValue("animation-name")==="none")&&(this._animationsDisabled=!0)}e&&this._onShow(),this._animationsDisabled&&(t.classList.add("_mat-animation-noopable"),this._finalizeAnimation(e))}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-tooltip-component"]],viewQuery:function(t,i){if(t&1&&me(Hr,7),t&2){let r;I(r=V())&&(i._tooltip=r.first)}},hostAttrs:["aria-hidden","true"],hostBindings:function(t,i){t&1&&_("mouseleave",function(o){return i._handleMouseLeave(o)})},decls:4,vars:5,consts:[["tooltip",""],[1,"mdc-tooltip","mat-mdc-tooltip",3,"animationend"],[1,"mat-mdc-tooltip-surface","mdc-tooltip__surface"]],template:function(t,i){t&1&&(ee(0,"div",1,0),zt("animationend",function(o){return i._handleAnimationEnd(o)}),ee(2,"div",2),b(3),re()()),t&2&&(pt(i.tooltipClass),k("mdc-tooltip--multiline",i._isMultiline),l(3),M(i.message))},styles:[`.mat-mdc-tooltip {
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
`],encapsulation:2,changeDetection:0})}return n})();var ft=new N("MAT_INPUT_VALUE_ACCESSOR");var Qr=["mat-calendar-body",""];function Jr(n,a){return this._trackRow(a)}var Fa=(n,a)=>a.id;function eo(n,a){if(n&1&&(ee(0,"tr",0)(1,"td",3),b(2),re()()),n&2){let e=d();l(),Je("padding-top",e._cellPadding)("padding-bottom",e._cellPadding),w("colspan",e.numCols),l(),ze(" ",e.label," ")}}function to(n,a){if(n&1&&(ee(0,"td",3),b(1),re()),n&2){let e=d(2);Je("padding-top",e._cellPadding)("padding-bottom",e._cellPadding),w("colspan",e._firstRowOffset),l(),ze(" ",e._firstRowOffset>=e.labelMinRequiredCells?e.label:""," ")}}function io(n,a){if(n&1){let e=R();ee(0,"td",6)(1,"button",7),zt("click",function(i){let r=m(e).$implicit,o=d(2);return h(o._cellClicked(r,i))})("focus",function(i){let r=m(e).$implicit,o=d(2);return h(o._emitActiveDateChange(r,i))}),ee(2,"span",8),b(3),re(),ct(4,"span",9),re()()}if(n&2){let e=a.$implicit,t=a.$index,i=d().$index,r=d();Je("width",r._cellWidth)("padding-top",r._cellPadding)("padding-bottom",r._cellPadding),w("data-mat-row",i)("data-mat-col",t),l(),pt(e.cssClasses),k("mat-calendar-body-disabled",!e.enabled)("mat-calendar-body-active",r._isActiveCell(i,t))("mat-calendar-body-range-start",r._isRangeStart(e.compareValue))("mat-calendar-body-range-end",r._isRangeEnd(e.compareValue))("mat-calendar-body-in-range",r._isInRange(e.compareValue))("mat-calendar-body-comparison-bridge-start",r._isComparisonBridgeStart(e.compareValue,i,t))("mat-calendar-body-comparison-bridge-end",r._isComparisonBridgeEnd(e.compareValue,i,t))("mat-calendar-body-comparison-start",r._isComparisonStart(e.compareValue))("mat-calendar-body-comparison-end",r._isComparisonEnd(e.compareValue))("mat-calendar-body-in-comparison-range",r._isInComparisonRange(e.compareValue))("mat-calendar-body-preview-start",r._isPreviewStart(e.compareValue))("mat-calendar-body-preview-end",r._isPreviewEnd(e.compareValue))("mat-calendar-body-in-preview",r._isInPreview(e.compareValue)),oe("tabIndex",r._isActiveCell(i,t)?0:-1),w("aria-label",e.ariaLabel)("aria-disabled",!e.enabled||null)("aria-pressed",r._isSelected(e.compareValue))("aria-current",r.todayValue===e.compareValue?"date":null)("aria-describedby",r._getDescribedby(e.compareValue)),l(),k("mat-calendar-body-selected",r._isSelected(e.compareValue))("mat-calendar-body-comparison-identical",r._isComparisonIdentical(e.compareValue))("mat-calendar-body-today",r.todayValue===e.compareValue),l(),ze(" ",e.displayValue," ")}}function no(n,a){if(n&1&&(ee(0,"tr",1),C(1,to,2,6,"td",4),ye(2,io,5,49,"td",5,Fa),re()),n&2){let e=a.$implicit,t=a.$index,i=d();l(),x(t===0&&i._firstRowOffset?1:-1),l(),Ce(e)}}function ao(n,a){if(n&1&&(c(0,"th",2)(1,"span",6),b(2),u(),c(3,"span",3),b(4),u()()),n&2){let e=a.$implicit;l(2),M(e.long),l(2),M(e.narrow)}}var ro=["*"];function oo(n,a){}function so(n,a){if(n&1){let e=R();c(0,"mat-month-view",4),qt("activeDateChange",function(i){m(e);let r=d();return Wt(r.activeDate,i)||(r.activeDate=i),h(i)}),_("_userSelection",function(i){m(e);let r=d();return h(r._dateSelected(i))})("dragStarted",function(i){m(e);let r=d();return h(r._dragStarted(i))})("dragEnded",function(i){m(e);let r=d();return h(r._dragEnded(i))}),u()}if(n&2){let e=d();jt("activeDate",e.activeDate),g("selected",e.selected)("dateFilter",e.dateFilter)("maxDate",e.maxDate)("minDate",e.minDate)("dateClass",e.dateClass)("comparisonStart",e.comparisonStart)("comparisonEnd",e.comparisonEnd)("startDateAccessibleName",e.startDateAccessibleName)("endDateAccessibleName",e.endDateAccessibleName)("activeDrag",e._activeDrag)}}function lo(n,a){if(n&1){let e=R();c(0,"mat-year-view",5),qt("activeDateChange",function(i){m(e);let r=d();return Wt(r.activeDate,i)||(r.activeDate=i),h(i)}),_("monthSelected",function(i){m(e);let r=d();return h(r._monthSelectedInYearView(i))})("selectedChange",function(i){m(e);let r=d();return h(r._goToDateInView(i,"month"))}),u()}if(n&2){let e=d();jt("activeDate",e.activeDate),g("selected",e.selected)("dateFilter",e.dateFilter)("maxDate",e.maxDate)("minDate",e.minDate)("dateClass",e.dateClass)}}function co(n,a){if(n&1){let e=R();c(0,"mat-multi-year-view",6),qt("activeDateChange",function(i){m(e);let r=d();return Wt(r.activeDate,i)||(r.activeDate=i),h(i)}),_("yearSelected",function(i){m(e);let r=d();return h(r._yearSelectedInMultiYearView(i))})("selectedChange",function(i){m(e);let r=d();return h(r._goToDateInView(i,"year"))}),u()}if(n&2){let e=d();jt("activeDate",e.activeDate),g("selected",e.selected)("dateFilter",e.dateFilter)("maxDate",e.maxDate)("minDate",e.minDate)("dateClass",e.dateClass)}}function po(n,a){}var uo=["button"],mo=[[["","matDatepickerToggleIcon",""]]],ho=["[matDatepickerToggleIcon]"];function _o(n,a){n&1&&(Qe(),c(0,"svg",2),J(1,"path",3),u())}var fo=[[["input","matStartDate",""]],[["input","matEndDate",""]]],go=["input[matStartDate]","input[matEndDate]"];var xt=(()=>{class n{changes=new A;calendarLabel="Calendar";openCalendarLabel="Open calendar";closeCalendarLabel="Close calendar";prevMonthLabel="Previous month";nextMonthLabel="Next month";prevYearLabel="Previous year";nextYearLabel="Next year";prevMultiYearLabel="Previous 24 years";nextMultiYearLabel="Next 24 years";switchToMonthViewLabel="Choose date";switchToMultiYearViewLabel="Choose month and year";startDateLabel="Start date";endDateLabel="End date";comparisonDateLabel="Comparison range";formatYearRange(e,t){return`${e} \u2013 ${t}`}formatYearRangeLabel(e,t){return`${e} to ${t}`}static \u0275fac=function(t){return new(t||n)};static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})(),bo=0,Vt=class{value;displayValue;ariaLabel;enabled;compareValue;rawValue;id=bo++;cssClasses;constructor(a,e,t,i,r,o=a,p){this.value=a,this.displayValue=e,this.ariaLabel=t,this.enabled=i,this.compareValue=o,this.rawValue=p,this.cssClasses=r instanceof Set?Array.from(r):r}},vo={passive:!1,capture:!0},xi={passive:!0,capture:!0},Oa={passive:!0},vt=(()=>{class n{_elementRef=s(O);_ngZone=s(L);_platform=s(Q);_intl=s(xt);_eventCleanups;_skipNextFocus=!1;_focusActiveCellAfterViewChecked=!1;label;rows;todayValue;startValue;endValue;labelMinRequiredCells;numCols=7;activeCell=0;ngAfterViewChecked(){this._focusActiveCellAfterViewChecked&&(this._focusActiveCell(),this._focusActiveCellAfterViewChecked=!1)}isRange=!1;cellAspectRatio=1;comparisonStart=null;comparisonEnd=null;previewStart=null;previewEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;selectedValueChange=new D;previewChange=new D;activeDateChange=new D;dragStarted=new D;dragEnded=new D;_firstRowOffset;_cellPadding;_cellWidth;_startDateLabelId;_endDateLabelId;_comparisonStartDateLabelId;_comparisonEndDateLabelId;_didDragSinceMouseDown=!1;_injector=s(j);comparisonDateAccessibleName=this._intl.comparisonDateLabel;_trackRow=e=>e;constructor(){let e=s(ae),t=s(ce);this._startDateLabelId=t.getId("mat-calendar-body-start-"),this._endDateLabelId=t.getId("mat-calendar-body-end-"),this._comparisonStartDateLabelId=t.getId("mat-calendar-body-comparison-start-"),this._comparisonEndDateLabelId=t.getId("mat-calendar-body-comparison-end-"),s(Me).load(Kn),this._ngZone.runOutsideAngular(()=>{let i=this._elementRef.nativeElement,r=[e.listen(i,"touchmove",this._touchmoveHandler,vo),e.listen(i,"mouseenter",this._enterHandler,xi),e.listen(i,"focus",this._enterHandler,xi),e.listen(i,"mouseleave",this._leaveHandler,xi),e.listen(i,"blur",this._leaveHandler,xi),e.listen(i,"mousedown",this._mousedownHandler,Oa),e.listen(i,"touchstart",this._mousedownHandler,Oa)];this._platform.isBrowser&&r.push(e.listen("window","mouseup",this._mouseupHandler),e.listen("window","touchend",this._touchendHandler)),this._eventCleanups=r})}_cellClicked(e,t){this._didDragSinceMouseDown||e.enabled&&this.selectedValueChange.emit({value:e.value,event:t})}_emitActiveDateChange(e,t){e.enabled&&this.activeDateChange.emit({value:e.value,event:t})}_isSelected(e){return this.startValue===e||this.endValue===e}ngOnChanges(e){let t=e.numCols,{rows:i,numCols:r}=this;(e.rows||t)&&(this._firstRowOffset=i&&i.length&&i[0].length?r-i[0].length:0),(e.cellAspectRatio||t||!this._cellPadding)&&(this._cellPadding=`${50*this.cellAspectRatio/r}%`),(t||!this._cellWidth)&&(this._cellWidth=`${100/r}%`)}ngOnDestroy(){this._eventCleanups.forEach(e=>e())}_isActiveCell(e,t){let i=e*this.numCols+t;return e&&(i-=this._firstRowOffset),i==this.activeCell}_focusActiveCell(e=!0){fe(()=>{setTimeout(()=>{let t=this._elementRef.nativeElement.querySelector(".mat-calendar-body-active");t&&(e||(this._skipNextFocus=!0),t.focus())})},{injector:this._injector})}_scheduleFocusActiveCellAfterViewChecked(){this._focusActiveCellAfterViewChecked=!0}_isRangeStart(e){return an(e,this.startValue,this.endValue)}_isRangeEnd(e){return rn(e,this.startValue,this.endValue)}_isInRange(e){return on(e,this.startValue,this.endValue,this.isRange)}_isComparisonStart(e){return an(e,this.comparisonStart,this.comparisonEnd)}_isComparisonBridgeStart(e,t,i){if(!this._isComparisonStart(e)||this._isRangeStart(e)||!this._isInRange(e))return!1;let r=this.rows[t][i-1];if(!r){let o=this.rows[t-1];r=o&&o[o.length-1]}return r&&!this._isRangeEnd(r.compareValue)}_isComparisonBridgeEnd(e,t,i){if(!this._isComparisonEnd(e)||this._isRangeEnd(e)||!this._isInRange(e))return!1;let r=this.rows[t][i+1];if(!r){let o=this.rows[t+1];r=o&&o[0]}return r&&!this._isRangeStart(r.compareValue)}_isComparisonEnd(e){return rn(e,this.comparisonStart,this.comparisonEnd)}_isInComparisonRange(e){return on(e,this.comparisonStart,this.comparisonEnd,this.isRange)}_isComparisonIdentical(e){return this.comparisonStart===this.comparisonEnd&&e===this.comparisonStart}_isPreviewStart(e){return an(e,this.previewStart,this.previewEnd)}_isPreviewEnd(e){return rn(e,this.previewStart,this.previewEnd)}_isInPreview(e){return on(e,this.previewStart,this.previewEnd,this.isRange)}_getDescribedby(e){if(!this.isRange)return null;if(this.startValue===e&&this.endValue===e)return`${this._startDateLabelId} ${this._endDateLabelId}`;if(this.startValue===e)return this._startDateLabelId;if(this.endValue===e)return this._endDateLabelId;if(this.comparisonStart!==null&&this.comparisonEnd!==null){if(e===this.comparisonStart&&e===this.comparisonEnd)return`${this._comparisonStartDateLabelId} ${this._comparisonEndDateLabelId}`;if(e===this.comparisonStart)return this._comparisonStartDateLabelId;if(e===this.comparisonEnd)return this._comparisonEndDateLabelId}return null}_enterHandler=e=>{if(this._skipNextFocus&&e.type==="focus"){this._skipNextFocus=!1;return}if(e.target&&this.isRange){let t=this._getCellFromElement(e.target);t&&this._ngZone.run(()=>this.previewChange.emit({value:t.enabled?t:null,event:e}))}};_touchmoveHandler=e=>{if(!this.isRange)return;let t=Pa(e),i=t?this._getCellFromElement(t):null;t!==e.target&&(this._didDragSinceMouseDown=!0),nn(e.target)&&e.preventDefault(),this._ngZone.run(()=>this.previewChange.emit({value:i?.enabled?i:null,event:e}))};_leaveHandler=e=>{this.previewEnd!==null&&this.isRange&&(e.type!=="blur"&&(this._didDragSinceMouseDown=!0),e.target&&this._getCellFromElement(e.target)&&!(e.relatedTarget&&this._getCellFromElement(e.relatedTarget))&&this._ngZone.run(()=>this.previewChange.emit({value:null,event:e})))};_mousedownHandler=e=>{if(!this.isRange)return;this._didDragSinceMouseDown=!1;let t=e.target&&this._getCellFromElement(e.target);!t||!this._isInRange(t.compareValue)||this._ngZone.run(()=>{this.dragStarted.emit({value:t.rawValue,event:e})})};_mouseupHandler=e=>{if(!this.isRange)return;let t=nn(e.target);if(!t){this._ngZone.run(()=>{this.dragEnded.emit({value:null,event:e})});return}t.closest(".mat-calendar-body")===this._elementRef.nativeElement&&this._ngZone.run(()=>{let i=this._getCellFromElement(t);this.dragEnded.emit({value:i?.rawValue??null,event:e})})};_touchendHandler=e=>{let t=Pa(e);t&&this._mouseupHandler({target:t})};_getCellFromElement(e){let t=nn(e);if(t){let i=t.getAttribute("data-mat-row"),r=t.getAttribute("data-mat-col");if(i&&r)return this.rows[parseInt(i)]?.[parseInt(r)]||null}return null}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["","mat-calendar-body",""]],hostAttrs:[1,"mat-calendar-body"],inputs:{label:"label",rows:"rows",todayValue:"todayValue",startValue:"startValue",endValue:"endValue",labelMinRequiredCells:"labelMinRequiredCells",numCols:"numCols",activeCell:"activeCell",isRange:"isRange",cellAspectRatio:"cellAspectRatio",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd",previewStart:"previewStart",previewEnd:"previewEnd",startDateAccessibleName:"startDateAccessibleName",endDateAccessibleName:"endDateAccessibleName"},outputs:{selectedValueChange:"selectedValueChange",previewChange:"previewChange",activeDateChange:"activeDateChange",dragStarted:"dragStarted",dragEnded:"dragEnded"},exportAs:["matCalendarBody"],features:[ue],attrs:Qr,decls:11,vars:11,consts:[["aria-hidden","true"],["role","row"],[1,"mat-calendar-body-hidden-label",3,"id"],[1,"mat-calendar-body-label"],[1,"mat-calendar-body-label",3,"paddingTop","paddingBottom"],["role","gridcell",1,"mat-calendar-body-cell-container",3,"width","paddingTop","paddingBottom"],["role","gridcell",1,"mat-calendar-body-cell-container"],["type","button",1,"mat-calendar-body-cell",3,"click","focus","tabindex"],[1,"mat-calendar-body-cell-content","mat-focus-indicator"],["aria-hidden","true",1,"mat-calendar-body-cell-preview"]],template:function(t,i){t&1&&(C(0,eo,3,6,"tr",0),ye(1,no,4,1,"tr",1,Jr,!0),ee(3,"span",2),b(4),re(),ee(5,"span",2),b(6),re(),ee(7,"span",2),b(8),re(),ee(9,"span",2),b(10),re()),t&2&&(x(i._firstRowOffset<i.labelMinRequiredCells?0:-1),l(),Ce(i.rows),l(2),oe("id",i._startDateLabelId),l(),ze(" ",i.startDateAccessibleName,`
`),l(),oe("id",i._endDateLabelId),l(),ze(" ",i.endDateAccessibleName,`
`),l(),oe("id",i._comparisonStartDateLabelId),l(),Fi(" ",i.comparisonDateAccessibleName," ",i.startDateAccessibleName,`
`),l(),oe("id",i._comparisonEndDateLabelId),l(),Fi(" ",i.comparisonDateAccessibleName," ",i.endDateAccessibleName,`
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
`],encapsulation:2,changeDetection:0})}return n})();function tn(n){return n?.nodeName==="TD"}function nn(n){let a;return tn(n)?a=n:tn(n.parentNode)?a=n.parentNode:tn(n.parentNode?.parentNode)&&(a=n.parentNode.parentNode),a?.getAttribute("data-mat-row")!=null?a:null}function an(n,a,e){return e!==null&&a!==e&&n<e&&n===a}function rn(n,a,e){return a!==null&&a!==e&&n>=a&&n===e}function on(n,a,e,t){return t&&a!==null&&e!==null&&a!==e&&n>=a&&n<=e}function Pa(n){let a=n.changedTouches[0];return document.elementFromPoint(a.clientX,a.clientY)}var $=class{start;end;_disableStructuralEquivalency;constructor(a,e){this.start=a,this.end=e}},Ue=(()=>{class n{selection;_adapter;_selectionChanged=new A;selectionChanged=this._selectionChanged;constructor(e,t){this.selection=e,this._adapter=t,this.selection=e}updateSelection(e,t){let i=this.selection;this.selection=e,this._selectionChanged.next({selection:e,source:t,oldValue:i})}ngOnDestroy(){this._selectionChanged.complete()}_isValidDateInstance(e){return this._adapter.isDateInstance(e)&&this._adapter.isValid(e)}static \u0275fac=function(t){wn()};static \u0275prov=z({token:n,factory:n.\u0275fac})}return n})(),yo=(()=>{class n extends Ue{constructor(e){super(null,e)}add(e){super.updateSelection(e,this)}isValid(){return this.selection!=null&&this._isValidDateInstance(this.selection)}isComplete(){return this.selection!=null}clone(){let e=new n(this._adapter);return e.updateSelection(this.selection,this),e}static \u0275fac=function(t){return new(t||n)(Nt(X))};static \u0275prov=z({token:n,factory:n.\u0275fac})}return n})(),Co=(()=>{class n extends Ue{constructor(e){super(new $(null,null),e)}add(e){let{start:t,end:i}=this.selection;t==null?t=e:i==null?i=e:(t=e,i=null),super.updateSelection(new $(t,i),this)}isValid(){let{start:e,end:t}=this.selection;return e==null&&t==null?!0:e!=null&&t!=null?this._isValidDateInstance(e)&&this._isValidDateInstance(t)&&this._adapter.compareDate(e,t)<=0:(e==null||this._isValidDateInstance(e))&&(t==null||this._isValidDateInstance(t))}isComplete(){return this.selection.start!=null&&this.selection.end!=null}clone(){let e=new n(this._adapter);return e.updateSelection(this.selection,this),e}static \u0275fac=function(t){return new(t||n)(Nt(X))};static \u0275prov=z({token:n,factory:n.\u0275fac})}return n})(),La={provide:Ue,useFactory:()=>s(Ue,{optional:!0,skipSelf:!0})||new yo(s(X))},xo={provide:Ue,useFactory:()=>s(Ue,{optional:!0,skipSelf:!0})||new Co(s(X))},Di=new N("MAT_DATE_RANGE_SELECTION_STRATEGY"),Do=(()=>{class n{_dateAdapter;constructor(e){this._dateAdapter=e}selectionFinished(e,t){let{start:i,end:r}=t;return i==null?i=e:r==null&&e&&this._dateAdapter.compareDate(e,i)>=0?r=e:(i=e,r=null),new $(i,r)}createPreview(e,t){let i=null,r=null;return t.start&&!t.end&&e&&(i=t.start,r=e),new $(i,r)}createDrag(e,t,i){let r=t.start,o=t.end;if(!r||!o)return null;let p=this._dateAdapter,f=p.compareDate(r,o)!==0,y=p.getYear(i)-p.getYear(e),v=p.getMonth(i)-p.getMonth(e),S=p.getDate(i)-p.getDate(e);return f&&p.sameDate(e,t.start)?(r=i,p.compareDate(i,o)>0&&(o=p.addCalendarYears(o,y),o=p.addCalendarMonths(o,v),o=p.addCalendarDays(o,S))):f&&p.sameDate(e,t.end)?(o=i,p.compareDate(i,r)<0&&(r=p.addCalendarYears(r,y),r=p.addCalendarMonths(r,v),r=p.addCalendarDays(r,S))):(r=p.addCalendarYears(r,y),r=p.addCalendarMonths(r,v),r=p.addCalendarDays(r,S),o=p.addCalendarYears(o,y),o=p.addCalendarMonths(o,v),o=p.addCalendarDays(o,S)),new $(r,o)}static \u0275fac=function(t){return new(t||n)(Nt(X))};static \u0275prov=z({token:n,factory:n.\u0275fac})}return n})(),sn=7,wo=0,Ta=(()=>{class n{_changeDetectorRef=s(Z);_dateFormats=s(Ie,{optional:!0});_dateAdapter=s(X,{optional:!0});_dir=s(se,{optional:!0});_rangeStrategy=s(Di,{optional:!0});_rerenderSubscription=B.EMPTY;_selectionKeyPressed=!1;get activeDate(){return this._activeDate}set activeDate(e){let t=this._activeDate,i=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))||this._dateAdapter.today();this._activeDate=this._dateAdapter.clampDate(i,this.minDate,this.maxDate),this._hasSameMonthAndYear(t,this._activeDate)||this._init()}_activeDate;get selected(){return this._selected}set selected(e){e instanceof $?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e)),this._setRanges(this._selected)}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;comparisonStart=null;comparisonEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;activeDrag=null;selectedChange=new D;_userSelection=new D;dragStarted=new D;dragEnded=new D;activeDateChange=new D;_matCalendarBody;_monthLabel=E("");_weeks=E([]);_firstWeekOffset=E(0);_rangeStart=E(null);_rangeEnd=E(null);_comparisonRangeStart=E(null);_comparisonRangeEnd=E(null);_previewStart=E(null);_previewEnd=E(null);_isRange=E(!1);_todayDate=E(null);_weekdays=E([]);constructor(){s(Me).load(ni),this._activeDate=this._dateAdapter.today()}ngAfterContentInit(){this._rerenderSubscription=this._dateAdapter.localeChanges.pipe(Ze(null)).subscribe(()=>this._init())}ngOnChanges(e){let t=e.comparisonStart||e.comparisonEnd;t&&!t.firstChange&&this._setRanges(this.selected),e.activeDrag&&!this.activeDrag&&this._clearPreview()}ngOnDestroy(){this._rerenderSubscription.unsubscribe()}_dateSelected(e){let t=e.value,i=this._getDateFromDayOfMonth(t),r,o;this._selected instanceof $?(r=this._getDateInCurrentMonth(this._selected.start),o=this._getDateInCurrentMonth(this._selected.end)):r=o=this._getDateInCurrentMonth(this._selected),(r!==t||o!==t)&&this.selectedChange.emit(i),this._userSelection.emit({value:i,event:e.event}),this._clearPreview(),this._changeDetectorRef.markForCheck()}_updateActiveDate(e){let t=e.value,i=this._activeDate;this.activeDate=this._getDateFromDayOfMonth(t),this._dateAdapter.compareDate(i,this.activeDate)&&this.activeDateChange.emit(this._activeDate)}_handleCalendarBodyKeydown(e){let t=this._activeDate,i=this._isRtl();switch(e.keyCode){case 37:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,i?1:-1);break;case 39:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,i?-1:1);break;case 38:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,-7);break;case 40:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,7);break;case 36:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,1-this._dateAdapter.getDate(this._activeDate));break;case 35:this.activeDate=this._dateAdapter.addCalendarDays(this._activeDate,this._dateAdapter.getNumDaysInMonth(this._activeDate)-this._dateAdapter.getDate(this._activeDate));break;case 33:this.activeDate=e.altKey?this._dateAdapter.addCalendarYears(this._activeDate,-1):this._dateAdapter.addCalendarMonths(this._activeDate,-1);break;case 34:this.activeDate=e.altKey?this._dateAdapter.addCalendarYears(this._activeDate,1):this._dateAdapter.addCalendarMonths(this._activeDate,1);break;case 13:case 32:this._selectionKeyPressed=!0,this._canSelect(this._activeDate)&&e.preventDefault();return;case 27:this._previewEnd()!=null&&!de(e)&&(this._clearPreview(),this.activeDrag?this.dragEnded.emit({value:null,event:e}):(this.selectedChange.emit(null),this._userSelection.emit({value:null,event:e})),e.preventDefault(),e.stopPropagation());return;default:return}this._dateAdapter.compareDate(t,this.activeDate)&&(this.activeDateChange.emit(this.activeDate),this._focusActiveCellAfterViewChecked()),e.preventDefault()}_handleCalendarBodyKeyup(e){(e.keyCode===32||e.keyCode===13)&&(this._selectionKeyPressed&&this._canSelect(this._activeDate)&&this._dateSelected({value:this._dateAdapter.getDate(this._activeDate),event:e}),this._selectionKeyPressed=!1)}_init(){this._setRanges(this.selected),this._todayDate.set(this._getCellCompareValue(this._dateAdapter.today())),this._monthLabel.set(this._dateFormats.display.monthLabel?this._dateAdapter.format(this.activeDate,this._dateFormats.display.monthLabel):this._dateAdapter.getMonthNames("short")[this._dateAdapter.getMonth(this.activeDate)].toLocaleUpperCase());let e=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),this._dateAdapter.getMonth(this.activeDate),1);this._firstWeekOffset.set((sn+this._dateAdapter.getDayOfWeek(e)-this._dateAdapter.getFirstDayOfWeek())%sn),this._initWeekdays(),this._createWeekCells(),this._changeDetectorRef.markForCheck()}_focusActiveCell(e){this._matCalendarBody._focusActiveCell(e)}_focusActiveCellAfterViewChecked(){this._matCalendarBody._scheduleFocusActiveCellAfterViewChecked()}_previewChanged({event:e,value:t}){if(this._rangeStrategy){let i=t?t.rawValue:null,r=this._rangeStrategy.createPreview(i,this.selected,e);if(this._previewStart.set(this._getCellCompareValue(r.start)),this._previewEnd.set(this._getCellCompareValue(r.end)),this.activeDrag&&i){let o=this._rangeStrategy.createDrag?.(this.activeDrag.value,this.selected,i,e);o&&(this._previewStart.set(this._getCellCompareValue(o.start)),this._previewEnd.set(this._getCellCompareValue(o.end)))}}}_dragEnded(e){if(this.activeDrag)if(e.value){let t=this._rangeStrategy?.createDrag?.(this.activeDrag.value,this.selected,e.value,e.event);this.dragEnded.emit({value:t??null,event:e.event})}else this.dragEnded.emit({value:null,event:e.event})}_getDateFromDayOfMonth(e){return this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),this._dateAdapter.getMonth(this.activeDate),e)}_initWeekdays(){let e=this._dateAdapter.getFirstDayOfWeek(),t=this._dateAdapter.getDayOfWeekNames("narrow"),r=this._dateAdapter.getDayOfWeekNames("long").map((o,p)=>({long:o,narrow:t[p],id:wo++}));this._weekdays.set(r.slice(e).concat(r.slice(0,e)))}_createWeekCells(){let e=this._dateAdapter.getNumDaysInMonth(this.activeDate),t=this._dateAdapter.getDateNames(),i=[[]];for(let r=0,o=this._firstWeekOffset();r<e;r++,o++){o==sn&&(i.push([]),o=0);let p=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),this._dateAdapter.getMonth(this.activeDate),r+1),f=this._shouldEnableDate(p),y=this._dateAdapter.format(p,this._dateFormats.display.dateA11yLabel),v=this.dateClass?this.dateClass(p,"month"):void 0;i[i.length-1].push(new Vt(r+1,t[r],y,f,v,this._getCellCompareValue(p),p))}this._weeks.set(i)}_shouldEnableDate(e){return!!e&&(!this.minDate||this._dateAdapter.compareDate(e,this.minDate)>=0)&&(!this.maxDate||this._dateAdapter.compareDate(e,this.maxDate)<=0)&&(!this.dateFilter||this.dateFilter(e))}_getDateInCurrentMonth(e){return e&&this._hasSameMonthAndYear(e,this.activeDate)?this._dateAdapter.getDate(e):null}_hasSameMonthAndYear(e,t){return!!(e&&t&&this._dateAdapter.getMonth(e)==this._dateAdapter.getMonth(t)&&this._dateAdapter.getYear(e)==this._dateAdapter.getYear(t))}_getCellCompareValue(e){if(e){let t=this._dateAdapter.getYear(e),i=this._dateAdapter.getMonth(e),r=this._dateAdapter.getDate(e);return new Date(t,i,r).getTime()}return null}_isRtl(){return this._dir&&this._dir.value==="rtl"}_setRanges(e){e instanceof $?(this._rangeStart.set(this._getCellCompareValue(e.start)),this._rangeEnd.set(this._getCellCompareValue(e.end)),this._isRange.set(!0)):(this._rangeStart.set(this._getCellCompareValue(e)),this._rangeEnd.set(this._rangeStart()),this._isRange.set(!1)),this._comparisonRangeStart.set(this._getCellCompareValue(this.comparisonStart)),this._comparisonRangeEnd.set(this._getCellCompareValue(this.comparisonEnd))}_canSelect(e){return!this.dateFilter||this.dateFilter(e)}_clearPreview(){this._previewStart.set(null),this._previewEnd.set(null)}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-month-view"]],viewQuery:function(t,i){if(t&1&&me(vt,5),t&2){let r;I(r=V())&&(i._matCalendarBody=r.first)}},inputs:{activeDate:"activeDate",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd",startDateAccessibleName:"startDateAccessibleName",endDateAccessibleName:"endDateAccessibleName",activeDrag:"activeDrag"},outputs:{selectedChange:"selectedChange",_userSelection:"_userSelection",dragStarted:"dragStarted",dragEnded:"dragEnded",activeDateChange:"activeDateChange"},exportAs:["matMonthView"],features:[ue],decls:8,vars:14,consts:[["role","grid",1,"mat-calendar-table"],[1,"mat-calendar-table-header"],["scope","col"],["aria-hidden","true"],["colspan","7",1,"mat-calendar-table-header-divider"],["mat-calendar-body","",3,"selectedValueChange","activeDateChange","previewChange","dragStarted","dragEnded","keyup","keydown","label","rows","todayValue","startValue","endValue","comparisonStart","comparisonEnd","previewStart","previewEnd","isRange","labelMinRequiredCells","activeCell","startDateAccessibleName","endDateAccessibleName"],[1,"cdk-visually-hidden"]],template:function(t,i){t&1&&(c(0,"table",0)(1,"thead",1)(2,"tr"),ye(3,ao,5,2,"th",2,Fa),u(),c(5,"tr",3),J(6,"th",4),u()(),c(7,"tbody",5),_("selectedValueChange",function(o){return i._dateSelected(o)})("activeDateChange",function(o){return i._updateActiveDate(o)})("previewChange",function(o){return i._previewChanged(o)})("dragStarted",function(o){return i.dragStarted.emit(o)})("dragEnded",function(o){return i._dragEnded(o)})("keyup",function(o){return i._handleCalendarBodyKeyup(o)})("keydown",function(o){return i._handleCalendarBodyKeydown(o)}),u()()),t&2&&(l(3),Ce(i._weekdays()),l(4),g("label",i._monthLabel())("rows",i._weeks())("todayValue",i._todayDate())("startValue",i._rangeStart())("endValue",i._rangeEnd())("comparisonStart",i._comparisonRangeStart())("comparisonEnd",i._comparisonRangeEnd())("previewStart",i._previewStart())("previewEnd",i._previewEnd())("isRange",i._isRange())("labelMinRequiredCells",3)("activeCell",i._dateAdapter.getDate(i.activeDate)-1)("startDateAccessibleName",i.startDateAccessibleName)("endDateAccessibleName",i.endDateAccessibleName))},dependencies:[vt],encapsulation:2,changeDetection:0})}return n})(),he=24,ln=4,Ra=(()=>{class n{_changeDetectorRef=s(Z);_dateAdapter=s(X,{optional:!0});_dir=s(se,{optional:!0});_rerenderSubscription=B.EMPTY;_selectionKeyPressed=!1;get activeDate(){return this._activeDate}set activeDate(e){let t=this._activeDate,i=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))||this._dateAdapter.today();this._activeDate=this._dateAdapter.clampDate(i,this.minDate,this.maxDate),Na(this._dateAdapter,t,this._activeDate,this.minDate,this.maxDate)||this._init()}_activeDate;get selected(){return this._selected}set selected(e){e instanceof $?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e)),this._setSelectedYear(e)}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;selectedChange=new D;yearSelected=new D;activeDateChange=new D;_matCalendarBody;_years=E([]);_todayYear=E(0);_selectedYear=E(null);constructor(){this._dateAdapter,this._activeDate=this._dateAdapter.today()}ngAfterContentInit(){this._rerenderSubscription=this._dateAdapter.localeChanges.pipe(Ze(null)).subscribe(()=>this._init())}ngOnDestroy(){this._rerenderSubscription.unsubscribe()}_init(){this._todayYear.set(this._dateAdapter.getYear(this._dateAdapter.today()));let t=this._dateAdapter.getYear(this._activeDate)-It(this._dateAdapter,this.activeDate,this.minDate,this.maxDate),i=[];for(let r=0,o=[];r<he;r++)o.push(t+r),o.length==ln&&(i.push(o.map(p=>this._createCellForYear(p))),o=[]);this._years.set(i),this._changeDetectorRef.markForCheck()}_yearSelected(e){let t=e.value,i=this._dateAdapter.createDate(t,0,1),r=this._getDateFromYear(t);this.yearSelected.emit(i),this.selectedChange.emit(r)}_updateActiveDate(e){let t=e.value,i=this._activeDate;this.activeDate=this._getDateFromYear(t),this._dateAdapter.compareDate(i,this.activeDate)&&this.activeDateChange.emit(this.activeDate)}_handleCalendarBodyKeydown(e){let t=this._activeDate,i=this._isRtl();switch(e.keyCode){case 37:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,i?1:-1);break;case 39:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,i?-1:1);break;case 38:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,-ln);break;case 40:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,ln);break;case 36:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,-It(this._dateAdapter,this.activeDate,this.minDate,this.maxDate));break;case 35:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,he-It(this._dateAdapter,this.activeDate,this.minDate,this.maxDate)-1);break;case 33:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?-he*10:-he);break;case 34:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?he*10:he);break;case 13:case 32:this._selectionKeyPressed=!0;break;default:return}this._dateAdapter.compareDate(t,this.activeDate)&&this.activeDateChange.emit(this.activeDate),this._focusActiveCellAfterViewChecked(),e.preventDefault()}_handleCalendarBodyKeyup(e){(e.keyCode===32||e.keyCode===13)&&(this._selectionKeyPressed&&this._yearSelected({value:this._dateAdapter.getYear(this._activeDate),event:e}),this._selectionKeyPressed=!1)}_getActiveCell(){return It(this._dateAdapter,this.activeDate,this.minDate,this.maxDate)}_focusActiveCell(){this._matCalendarBody._focusActiveCell()}_focusActiveCellAfterViewChecked(){this._matCalendarBody._scheduleFocusActiveCellAfterViewChecked()}_getDateFromYear(e){let t=this._dateAdapter.getMonth(this.activeDate),i=this._dateAdapter.getNumDaysInMonth(this._dateAdapter.createDate(e,t,1));return this._dateAdapter.createDate(e,t,Math.min(this._dateAdapter.getDate(this.activeDate),i))}_createCellForYear(e){let t=this._dateAdapter.createDate(e,0,1),i=this._dateAdapter.getYearName(t),r=this.dateClass?this.dateClass(t,"multi-year"):void 0;return new Vt(e,i,i,this._shouldEnableYear(e),r)}_shouldEnableYear(e){if(e==null||this.maxDate&&e>this._dateAdapter.getYear(this.maxDate)||this.minDate&&e<this._dateAdapter.getYear(this.minDate))return!1;if(!this.dateFilter)return!0;let t=this._dateAdapter.createDate(e,0,1);for(let i=t;this._dateAdapter.getYear(i)==e;i=this._dateAdapter.addCalendarDays(i,1))if(this.dateFilter(i))return!0;return!1}_isRtl(){return this._dir&&this._dir.value==="rtl"}_setSelectedYear(e){if(this._selectedYear.set(null),e instanceof $){let t=e.start||e.end;t&&this._selectedYear.set(this._dateAdapter.getYear(t))}else e&&this._selectedYear.set(this._dateAdapter.getYear(e))}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-multi-year-view"]],viewQuery:function(t,i){if(t&1&&me(vt,5),t&2){let r;I(r=V())&&(i._matCalendarBody=r.first)}},inputs:{activeDate:"activeDate",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass"},outputs:{selectedChange:"selectedChange",yearSelected:"yearSelected",activeDateChange:"activeDateChange"},exportAs:["matMultiYearView"],decls:5,vars:7,consts:[["role","grid",1,"mat-calendar-table"],["aria-hidden","true",1,"mat-calendar-table-header"],["colspan","4",1,"mat-calendar-table-header-divider"],["mat-calendar-body","",3,"selectedValueChange","activeDateChange","keyup","keydown","rows","todayValue","startValue","endValue","numCols","cellAspectRatio","activeCell"]],template:function(t,i){t&1&&(c(0,"table",0)(1,"thead",1)(2,"tr"),J(3,"th",2),u()(),c(4,"tbody",3),_("selectedValueChange",function(o){return i._yearSelected(o)})("activeDateChange",function(o){return i._updateActiveDate(o)})("keyup",function(o){return i._handleCalendarBodyKeyup(o)})("keydown",function(o){return i._handleCalendarBodyKeydown(o)}),u()()),t&2&&(l(4),g("rows",i._years())("todayValue",i._todayYear())("startValue",i._selectedYear())("endValue",i._selectedYear())("numCols",4)("cellAspectRatio",4/7)("activeCell",i._getActiveCell()))},dependencies:[vt],encapsulation:2,changeDetection:0})}return n})();function Na(n,a,e,t,i){let r=n.getYear(a),o=n.getYear(e),p=Ba(n,t,i);return Math.floor((r-p)/he)===Math.floor((o-p)/he)}function It(n,a,e,t){let i=n.getYear(a);return ko(i-Ba(n,e,t),he)}function Ba(n,a,e){let t=0;return e?t=n.getYear(e)-he+1:a&&(t=n.getYear(a)),t}function ko(n,a){return(n%a+a)%a}var Ia=(()=>{class n{_changeDetectorRef=s(Z);_dateFormats=s(Ie,{optional:!0});_dateAdapter=s(X,{optional:!0});_dir=s(se,{optional:!0});_rerenderSubscription=B.EMPTY;_selectionKeyPressed=!1;get activeDate(){return this._activeDate}set activeDate(e){let t=this._activeDate,i=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))||this._dateAdapter.today();this._activeDate=this._dateAdapter.clampDate(i,this.minDate,this.maxDate),this._dateAdapter.getYear(t)!==this._dateAdapter.getYear(this._activeDate)&&this._init()}_activeDate;get selected(){return this._selected}set selected(e){e instanceof $?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e)),this._setSelectedMonth(e)}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;selectedChange=new D;monthSelected=new D;activeDateChange=new D;_matCalendarBody;_months=E([]);_yearLabel=E("");_todayMonth=E(null);_selectedMonth=E(null);constructor(){this._activeDate=this._dateAdapter.today()}ngAfterContentInit(){this._rerenderSubscription=this._dateAdapter.localeChanges.pipe(Ze(null)).subscribe(()=>this._init())}ngOnDestroy(){this._rerenderSubscription.unsubscribe()}_monthSelected(e){let t=e.value,i=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),t,1);this.monthSelected.emit(i);let r=this._getDateFromMonth(t);this.selectedChange.emit(r)}_updateActiveDate(e){let t=e.value,i=this._activeDate;this.activeDate=this._getDateFromMonth(t),this._dateAdapter.compareDate(i,this.activeDate)&&this.activeDateChange.emit(this.activeDate)}_handleCalendarBodyKeydown(e){let t=this._activeDate,i=this._isRtl();switch(e.keyCode){case 37:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,i?1:-1);break;case 39:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,i?-1:1);break;case 38:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,-4);break;case 40:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,4);break;case 36:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,-this._dateAdapter.getMonth(this._activeDate));break;case 35:this.activeDate=this._dateAdapter.addCalendarMonths(this._activeDate,11-this._dateAdapter.getMonth(this._activeDate));break;case 33:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?-10:-1);break;case 34:this.activeDate=this._dateAdapter.addCalendarYears(this._activeDate,e.altKey?10:1);break;case 13:case 32:this._selectionKeyPressed=!0;break;default:return}this._dateAdapter.compareDate(t,this.activeDate)&&(this.activeDateChange.emit(this.activeDate),this._focusActiveCellAfterViewChecked()),e.preventDefault()}_handleCalendarBodyKeyup(e){(e.keyCode===32||e.keyCode===13)&&(this._selectionKeyPressed&&this._monthSelected({value:this._dateAdapter.getMonth(this._activeDate),event:e}),this._selectionKeyPressed=!1)}_init(){this._setSelectedMonth(this.selected),this._todayMonth.set(this._getMonthInCurrentYear(this._dateAdapter.today())),this._yearLabel.set(this._dateAdapter.getYearName(this.activeDate));let e=this._dateAdapter.getMonthNames("short");this._months.set([[0,1,2,3],[4,5,6,7],[8,9,10,11]].map(t=>t.map(i=>this._createCellForMonth(i,e[i])))),this._changeDetectorRef.markForCheck()}_focusActiveCell(){this._matCalendarBody._focusActiveCell()}_focusActiveCellAfterViewChecked(){this._matCalendarBody._scheduleFocusActiveCellAfterViewChecked()}_getMonthInCurrentYear(e){return e&&this._dateAdapter.getYear(e)==this._dateAdapter.getYear(this.activeDate)?this._dateAdapter.getMonth(e):null}_getDateFromMonth(e){let t=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),e,1),i=this._dateAdapter.getNumDaysInMonth(t);return this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),e,Math.min(this._dateAdapter.getDate(this.activeDate),i))}_createCellForMonth(e,t){let i=this._dateAdapter.createDate(this._dateAdapter.getYear(this.activeDate),e,1),r=this._dateAdapter.format(i,this._dateFormats.display.monthYearA11yLabel),o=this.dateClass?this.dateClass(i,"year"):void 0;return new Vt(e,t.toLocaleUpperCase(),r,this._shouldEnableMonth(e),o)}_shouldEnableMonth(e){let t=this._dateAdapter.getYear(this.activeDate);if(e==null||this._isYearAndMonthAfterMaxDate(t,e)||this._isYearAndMonthBeforeMinDate(t,e))return!1;if(!this.dateFilter)return!0;let i=this._dateAdapter.createDate(t,e,1);for(let r=i;this._dateAdapter.getMonth(r)==e;r=this._dateAdapter.addCalendarDays(r,1))if(this.dateFilter(r))return!0;return!1}_isYearAndMonthAfterMaxDate(e,t){if(this.maxDate){let i=this._dateAdapter.getYear(this.maxDate),r=this._dateAdapter.getMonth(this.maxDate);return e>i||e===i&&t>r}return!1}_isYearAndMonthBeforeMinDate(e,t){if(this.minDate){let i=this._dateAdapter.getYear(this.minDate),r=this._dateAdapter.getMonth(this.minDate);return e<i||e===i&&t<r}return!1}_isRtl(){return this._dir&&this._dir.value==="rtl"}_setSelectedMonth(e){e instanceof $?this._selectedMonth.set(this._getMonthInCurrentYear(e.start)||this._getMonthInCurrentYear(e.end)):this._selectedMonth.set(this._getMonthInCurrentYear(e))}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-year-view"]],viewQuery:function(t,i){if(t&1&&me(vt,5),t&2){let r;I(r=V())&&(i._matCalendarBody=r.first)}},inputs:{activeDate:"activeDate",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass"},outputs:{selectedChange:"selectedChange",monthSelected:"monthSelected",activeDateChange:"activeDateChange"},exportAs:["matYearView"],decls:5,vars:9,consts:[["role","grid",1,"mat-calendar-table"],["aria-hidden","true",1,"mat-calendar-table-header"],["colspan","4",1,"mat-calendar-table-header-divider"],["mat-calendar-body","",3,"selectedValueChange","activeDateChange","keyup","keydown","label","rows","todayValue","startValue","endValue","labelMinRequiredCells","numCols","cellAspectRatio","activeCell"]],template:function(t,i){t&1&&(c(0,"table",0)(1,"thead",1)(2,"tr"),J(3,"th",2),u()(),c(4,"tbody",3),_("selectedValueChange",function(o){return i._monthSelected(o)})("activeDateChange",function(o){return i._updateActiveDate(o)})("keyup",function(o){return i._handleCalendarBodyKeyup(o)})("keydown",function(o){return i._handleCalendarBodyKeydown(o)}),u()()),t&2&&(l(4),g("label",i._yearLabel())("rows",i._months())("todayValue",i._todayMonth())("startValue",i._selectedMonth())("endValue",i._selectedMonth())("labelMinRequiredCells",2)("numCols",4)("cellAspectRatio",4/7)("activeCell",i._dateAdapter.getMonth(i.activeDate)))},dependencies:[vt],encapsulation:2,changeDetection:0})}return n})(),za=(()=>{class n{_intl=s(xt);calendar=s(dn);_dateAdapter=s(X,{optional:!0});_dateFormats=s(Ie,{optional:!0});_periodButtonText;_periodButtonDescription;_periodButtonLabel;_prevButtonLabel;_nextButtonLabel;constructor(){s(Me).load(ni);let e=s(Z);this._updateLabels(),this.calendar.stateChanges.subscribe(()=>{this._updateLabels(),e.markForCheck()})}get periodButtonText(){return this._periodButtonText}get periodButtonDescription(){return this._periodButtonDescription}get periodButtonLabel(){return this._periodButtonLabel}get prevButtonLabel(){return this._prevButtonLabel}get nextButtonLabel(){return this._nextButtonLabel}currentPeriodClicked(){this.calendar.currentView=this.calendar.currentView=="month"?"multi-year":"month"}previousClicked(){this.previousEnabled()&&(this.calendar.activeDate=this.calendar.currentView=="month"?this._dateAdapter.addCalendarMonths(this.calendar.activeDate,-1):this._dateAdapter.addCalendarYears(this.calendar.activeDate,this.calendar.currentView=="year"?-1:-he))}nextClicked(){this.nextEnabled()&&(this.calendar.activeDate=this.calendar.currentView=="month"?this._dateAdapter.addCalendarMonths(this.calendar.activeDate,1):this._dateAdapter.addCalendarYears(this.calendar.activeDate,this.calendar.currentView=="year"?1:he))}previousEnabled(){return this.calendar.minDate?!this.calendar.minDate||!this._isSameView(this.calendar.activeDate,this.calendar.minDate):!0}nextEnabled(){return!this.calendar.maxDate||!this._isSameView(this.calendar.activeDate,this.calendar.maxDate)}_updateLabels(){let e=this.calendar,t=this._intl,i=this._dateAdapter;e.currentView==="month"?(this._periodButtonText=i.format(e.activeDate,this._dateFormats.display.monthYearLabel).toLocaleUpperCase(),this._periodButtonDescription=i.format(e.activeDate,this._dateFormats.display.monthYearLabel).toLocaleUpperCase(),this._periodButtonLabel=t.switchToMultiYearViewLabel,this._prevButtonLabel=t.prevMonthLabel,this._nextButtonLabel=t.nextMonthLabel):e.currentView==="year"?(this._periodButtonText=i.getYearName(e.activeDate),this._periodButtonDescription=i.getYearName(e.activeDate),this._periodButtonLabel=t.switchToMonthViewLabel,this._prevButtonLabel=t.prevYearLabel,this._nextButtonLabel=t.nextYearLabel):(this._periodButtonText=t.formatYearRange(...this._formatMinAndMaxYearLabels()),this._periodButtonDescription=t.formatYearRangeLabel(...this._formatMinAndMaxYearLabels()),this._periodButtonLabel=t.switchToMonthViewLabel,this._prevButtonLabel=t.prevMultiYearLabel,this._nextButtonLabel=t.nextMultiYearLabel)}_isSameView(e,t){return this.calendar.currentView=="month"?this._dateAdapter.getYear(e)==this._dateAdapter.getYear(t)&&this._dateAdapter.getMonth(e)==this._dateAdapter.getMonth(t):this.calendar.currentView=="year"?this._dateAdapter.getYear(e)==this._dateAdapter.getYear(t):Na(this._dateAdapter,e,t,this.calendar.minDate,this.calendar.maxDate)}_formatMinAndMaxYearLabels(){let t=this._dateAdapter.getYear(this.calendar.activeDate)-It(this._dateAdapter,this.calendar.activeDate,this.calendar.minDate,this.calendar.maxDate),i=t+he-1,r=this._dateAdapter.getYearName(this._dateAdapter.createDate(t,0,1)),o=this._dateAdapter.getYearName(this._dateAdapter.createDate(i,0,1));return[r,o]}_periodButtonLabelId=s(ce).getId("mat-calendar-period-label-");static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-calendar-header"]],exportAs:["matCalendarHeader"],ngContentSelectors:ro,decls:17,vars:13,consts:[[1,"mat-calendar-header"],[1,"mat-calendar-controls"],["aria-live","polite",1,"cdk-visually-hidden",3,"id"],["matButton","","type","button",1,"mat-calendar-period-button",3,"click"],["aria-hidden","true"],["viewBox","0 0 10 5","focusable","false","aria-hidden","true",1,"mat-calendar-arrow"],["points","0,0 5,5 10,0"],[1,"mat-calendar-spacer"],["matIconButton","","type","button","disabledInteractive","",1,"mat-calendar-previous-button",3,"click","disabled","matTooltip"],["viewBox","0 0 24 24","focusable","false","aria-hidden","true"],["d","M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"],["matIconButton","","type","button","disabledInteractive","",1,"mat-calendar-next-button",3,"click","disabled","matTooltip"],["d","M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"]],template:function(t,i){t&1&&(ge(),c(0,"div",0)(1,"div",1)(2,"span",2),b(3),u(),c(4,"button",3),_("click",function(){return i.currentPeriodClicked()}),c(5,"span",4),b(6),u(),Qe(),c(7,"svg",5),J(8,"polygon",6),u()(),Ri(),J(9,"div",7),H(10),c(11,"button",8),_("click",function(){return i.previousClicked()}),Qe(),c(12,"svg",9),J(13,"path",10),u()(),Ri(),c(14,"button",11),_("click",function(){return i.nextClicked()}),Qe(),c(15,"svg",9),J(16,"path",12),u()()()()),t&2&&(l(2),g("id",i._periodButtonLabelId),l(),M(i.periodButtonDescription),l(),w("aria-label",i.periodButtonLabel)("aria-describedby",i._periodButtonLabelId),l(2),M(i.periodButtonText),l(),k("mat-calendar-invert",i.calendar.currentView!=="month"),l(4),g("disabled",!i.previousEnabled())("matTooltip",i.prevButtonLabel),w("aria-label",i.prevButtonLabel),l(3),g("disabled",!i.nextEnabled())("matTooltip",i.nextButtonLabel),w("aria-label",i.nextButtonLabel))},dependencies:[Hi,Ot,Aa],encapsulation:2,changeDetection:0})}return n})(),dn=(()=>{class n{_dateAdapter=s(X,{optional:!0});_dateFormats=s(Ie,{optional:!0});_changeDetectorRef=s(Z);_elementRef=s(O);headerComponent;_calendarHeaderPortal;_intlChanges;_moveFocusOnNextTick=!1;get startAt(){return this._startAt}set startAt(e){this._startAt=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_startAt=null;startView="month";get selected(){return this._selected}set selected(e){e instanceof $?this._selected=e:this._selected=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_selected=null;get minDate(){return this._minDate}set minDate(e){this._minDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_minDate=null;get maxDate(){return this._maxDate}set maxDate(e){this._maxDate=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_maxDate=null;dateFilter;dateClass;comparisonStart=null;comparisonEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;selectedChange=new D;yearSelected=new D;monthSelected=new D;viewChanged=new D(!0);_userSelection=new D;_userDragDrop=new D;monthView;yearView;multiYearView;get activeDate(){return this._clampedActiveDate}set activeDate(e){this._clampedActiveDate=this._dateAdapter.clampDate(e,this.minDate,this.maxDate),this.stateChanges.next(),this._changeDetectorRef.markForCheck()}_clampedActiveDate;get currentView(){return this._currentView}set currentView(e){let t=this._currentView!==e?e:null;this._currentView=e,this._moveFocusOnNextTick=!0,this._changeDetectorRef.markForCheck(),t&&(this.stateChanges.next(),this.viewChanged.emit(t))}_currentView;_activeDrag=null;stateChanges=new A;constructor(){this._intlChanges=s(xt).changes.subscribe(()=>{this._changeDetectorRef.markForCheck(),this.stateChanges.next()})}ngAfterContentInit(){this._calendarHeaderPortal=new qe(this.headerComponent||za),this.activeDate=this.startAt||this._dateAdapter.today(),this._currentView=this.startView}ngAfterViewChecked(){this._moveFocusOnNextTick&&(this._moveFocusOnNextTick=!1,this.focusActiveCell())}ngOnDestroy(){this._intlChanges.unsubscribe(),this.stateChanges.complete()}ngOnChanges(e){let t=e.minDate&&!this._dateAdapter.sameDate(e.minDate.previousValue,e.minDate.currentValue)?e.minDate:void 0,i=e.maxDate&&!this._dateAdapter.sameDate(e.maxDate.previousValue,e.maxDate.currentValue)?e.maxDate:void 0,r=t||i||e.dateFilter;if(r&&!r.firstChange){let o=this._getCurrentViewComponent();o&&(this._elementRef.nativeElement.contains(St())&&(this._moveFocusOnNextTick=!0),this._changeDetectorRef.detectChanges(),o._init())}this.stateChanges.next()}focusActiveCell(){this._getCurrentViewComponent()?._focusActiveCell(!1)}updateTodaysDate(){this._getCurrentViewComponent()?._init()}_dateSelected(e){let t=e.value;(this.selected instanceof $||t&&!this._dateAdapter.sameDate(t,this.selected))&&this.selectedChange.emit(t),this._userSelection.emit(e)}_yearSelectedInMultiYearView(e){this.yearSelected.emit(e)}_monthSelectedInYearView(e){this.monthSelected.emit(e)}_goToDateInView(e,t){this.activeDate=e,this.currentView=t}_dragStarted(e){this._activeDrag=e}_dragEnded(e){this._activeDrag&&(e.value&&this._userDragDrop.emit(e),this._activeDrag=null)}_getCurrentViewComponent(){return this.monthView||this.yearView||this.multiYearView}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-calendar"]],viewQuery:function(t,i){if(t&1&&me(Ta,5)(Ia,5)(Ra,5),t&2){let r;I(r=V())&&(i.monthView=r.first),I(r=V())&&(i.yearView=r.first),I(r=V())&&(i.multiYearView=r.first)}},hostAttrs:[1,"mat-calendar"],inputs:{headerComponent:"headerComponent",startAt:"startAt",startView:"startView",selected:"selected",minDate:"minDate",maxDate:"maxDate",dateFilter:"dateFilter",dateClass:"dateClass",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd",startDateAccessibleName:"startDateAccessibleName",endDateAccessibleName:"endDateAccessibleName"},outputs:{selectedChange:"selectedChange",yearSelected:"yearSelected",monthSelected:"monthSelected",viewChanged:"viewChanged",_userSelection:"_userSelection",_userDragDrop:"_userDragDrop"},exportAs:["matCalendar"],features:[q([La]),ue],decls:5,vars:2,consts:[[3,"cdkPortalOutlet"],["cdkMonitorSubtreeFocus","","tabindex","-1",1,"mat-calendar-content"],[3,"activeDate","selected","dateFilter","maxDate","minDate","dateClass","comparisonStart","comparisonEnd","startDateAccessibleName","endDateAccessibleName","activeDrag"],[3,"activeDate","selected","dateFilter","maxDate","minDate","dateClass"],[3,"activeDateChange","_userSelection","dragStarted","dragEnded","activeDate","selected","dateFilter","maxDate","minDate","dateClass","comparisonStart","comparisonEnd","startDateAccessibleName","endDateAccessibleName","activeDrag"],[3,"activeDateChange","monthSelected","selectedChange","activeDate","selected","dateFilter","maxDate","minDate","dateClass"],[3,"activeDateChange","yearSelected","selectedChange","activeDate","selected","dateFilter","maxDate","minDate","dateClass"]],template:function(t,i){if(t&1&&(Pe(0,oo,0,0,"ng-template",0),c(1,"div",1),C(2,so,1,11,"mat-month-view",2)(3,lo,1,6,"mat-year-view",3)(4,co,1,6,"mat-multi-year-view",3),u()),t&2){let r;g("cdkPortalOutlet",i._calendarHeaderPortal),l(2),x((r=i.currentView)==="month"?2:r==="year"?3:r==="multi-year"?4:-1)}},dependencies:[Ki,Ni,Ta,Ia,Ra],styles:[`.mat-calendar {
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
`],encapsulation:2,changeDetection:0})}return n})(),Mo=new N("mat-datepicker-scroll-strategy",{providedIn:"root",factory:()=>{let n=s(j);return()=>Fe(n)}}),Ha=(()=>{class n{_elementRef=s(O);_animationsDisabled=Se();_changeDetectorRef=s(Z);_globalModel=s(Ue);_dateAdapter=s(X);_ngZone=s(L);_rangeSelectionStrategy=s(Di,{optional:!0});_stateChanges;_model;_eventCleanups;_animationFallback;_calendar;color;datepicker;comparisonStart=null;comparisonEnd=null;startDateAccessibleName=null;endDateAccessibleName=null;_isAbove=!1;_animationDone=new A;_isAnimating=!1;_closeButtonText;_closeButtonFocused=!1;_actionsPortal=null;_dialogLabelId=null;constructor(){if(s(Me).load(ni),this._closeButtonText=s(xt).closeCalendarLabel,!this._animationsDisabled){let e=this._elementRef.nativeElement,t=s(ae);this._eventCleanups=this._ngZone.runOutsideAngular(()=>[t.listen(e,"animationstart",this._handleAnimationEvent),t.listen(e,"animationend",this._handleAnimationEvent),t.listen(e,"animationcancel",this._handleAnimationEvent)])}}ngAfterViewInit(){this._stateChanges=this.datepicker.stateChanges.subscribe(()=>{this._changeDetectorRef.markForCheck()}),this._calendar.focusActiveCell()}ngOnDestroy(){clearTimeout(this._animationFallback),this._eventCleanups?.forEach(e=>e()),this._stateChanges?.unsubscribe(),this._animationDone.complete()}_handleUserSelection(e){let t=this._model.selection,i=e.value,r=t instanceof $;if(r&&this._rangeSelectionStrategy){let o=this._rangeSelectionStrategy.selectionFinished(i,t,e.event);this._model.updateSelection(o,this)}else i&&(r||!this._dateAdapter.sameDate(i,t))&&this._model.add(i);(!this._model||this._model.isComplete())&&!this._actionsPortal&&this.datepicker.close()}_handleUserDragDrop(e){this._model.updateSelection(e.value,this)}_startExitAnimation(){this._elementRef.nativeElement.classList.add("mat-datepicker-content-exit"),this._animationsDisabled?this._animationDone.next():(clearTimeout(this._animationFallback),this._animationFallback=setTimeout(()=>{this._isAnimating||this._animationDone.next()},200))}_handleAnimationEvent=e=>{let t=this._elementRef.nativeElement;e.target!==t||!e.animationName.startsWith("_mat-datepicker-content")||(clearTimeout(this._animationFallback),this._isAnimating=e.type==="animationstart",t.classList.toggle("mat-datepicker-content-animating",this._isAnimating),this._isAnimating||this._animationDone.next())};_getSelected(){return this._model.selection}_applyPendingSelection(){this._model!==this._globalModel&&this._globalModel.updateSelection(this._model.selection,this)}_assignActions(e,t){this._model=e?this._globalModel.clone():this._globalModel,this._actionsPortal=e,t&&this._changeDetectorRef.detectChanges()}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-datepicker-content"]],viewQuery:function(t,i){if(t&1&&me(dn,5),t&2){let r;I(r=V())&&(i._calendar=r.first)}},hostAttrs:[1,"mat-datepicker-content"],hostVars:6,hostBindings:function(t,i){t&2&&(pt(i.color?"mat-"+i.color:""),k("mat-datepicker-content-touch",i.datepicker.touchUi)("mat-datepicker-content-animations-enabled",!i._animationsDisabled))},inputs:{color:"color"},exportAs:["matDatepickerContent"],decls:5,vars:26,consts:[["cdkTrapFocus","","role","dialog",1,"mat-datepicker-content-container"],[3,"yearSelected","monthSelected","viewChanged","_userSelection","_userDragDrop","id","startAt","startView","minDate","maxDate","dateFilter","headerComponent","selected","dateClass","comparisonStart","comparisonEnd","startDateAccessibleName","endDateAccessibleName"],[3,"cdkPortalOutlet"],["type","button","matButton","elevated",1,"mat-datepicker-close-button",3,"focus","blur","click","color"]],template:function(t,i){t&1&&(c(0,"div",0)(1,"mat-calendar",1),_("yearSelected",function(o){return i.datepicker._selectYear(o)})("monthSelected",function(o){return i.datepicker._selectMonth(o)})("viewChanged",function(o){return i.datepicker._viewChanged(o)})("_userSelection",function(o){return i._handleUserSelection(o)})("_userDragDrop",function(o){return i._handleUserDragDrop(o)}),u(),Pe(2,po,0,0,"ng-template",2),c(3,"button",3),_("focus",function(){return i._closeButtonFocused=!0})("blur",function(){return i._closeButtonFocused=!1})("click",function(){return i.datepicker.close()}),b(4),u()()),t&2&&(k("mat-datepicker-content-container-with-custom-header",i.datepicker.calendarHeaderComponent)("mat-datepicker-content-container-with-actions",i._actionsPortal),w("aria-modal",!0)("aria-labelledby",i._dialogLabelId??void 0),l(),pt(i.datepicker.panelClass),g("id",i.datepicker.id)("startAt",i.datepicker.startAt)("startView",i.datepicker.startView)("minDate",i.datepicker._getMinDate())("maxDate",i.datepicker._getMaxDate())("dateFilter",i.datepicker._getDateFilter())("headerComponent",i.datepicker.calendarHeaderComponent)("selected",i._getSelected())("dateClass",i.datepicker.dateClass)("comparisonStart",i.comparisonStart)("comparisonEnd",i.comparisonEnd)("startDateAccessibleName",i.startDateAccessibleName)("endDateAccessibleName",i.endDateAccessibleName),l(),g("cdkPortalOutlet",i._actionsPortal),l(),k("cdk-visually-hidden",!i._closeButtonFocused),g("color",i.color||"primary"),l(),M(i._closeButtonText))},dependencies:[Yn,dn,Ki,Hi],styles:[`@keyframes _mat-datepicker-content-dropdown-enter {
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
`],encapsulation:2,changeDetection:0})}return n})(),wi=(()=>{class n{_injector=s(j);_viewContainerRef=s(ve);_dateAdapter=s(X,{optional:!0});_dir=s(se,{optional:!0});_model=s(Ue);_animationsDisabled=Se();_scrollStrategy=s(Mo);_inputStateChanges=B.EMPTY;_document=s(ne);calendarHeaderComponent;get startAt(){return this._startAt||(this.datepickerInput?this.datepickerInput.getStartValue():null)}set startAt(e){this._startAt=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e))}_startAt=null;startView="month";get color(){return this._color||(this.datepickerInput?this.datepickerInput.getThemePalette():void 0)}set color(e){this._color=e}_color;touchUi=!1;get disabled(){return this._disabled===void 0&&this.datepickerInput?this.datepickerInput.disabled:!!this._disabled}set disabled(e){e!==this._disabled&&(this._disabled=e,this.stateChanges.next(void 0))}_disabled;xPosition="start";yPosition="below";restoreFocus=!0;yearSelected=new D;monthSelected=new D;viewChanged=new D(!0);dateClass;openedStream=new D;closedStream=new D;get panelClass(){return this._panelClass}set panelClass(e){this._panelClass=$n(e)}_panelClass;get opened(){return this._opened}set opened(e){e?this.open():this.close()}_opened=!1;id=s(ce).getId("mat-datepicker-");_getMinDate(){return this.datepickerInput&&this.datepickerInput.min}_getMaxDate(){return this.datepickerInput&&this.datepickerInput.max}_getDateFilter(){return this.datepickerInput&&this.datepickerInput.dateFilter}_overlayRef=null;_componentRef=null;_focusedElementBeforeOpen=null;_backdropHarnessClass=`${this.id}-backdrop`;_actionsPortal=null;datepickerInput;stateChanges=new A;_changeDetectorRef=s(Z);constructor(){this._dateAdapter,this._model.selectionChanged.subscribe(()=>{this._changeDetectorRef.markForCheck()})}ngOnChanges(e){let t=e.xPosition||e.yPosition;if(t&&!t.firstChange&&this._overlayRef){let i=this._overlayRef.getConfig().positionStrategy;i instanceof _t&&(this._setConnectedPositions(i),this.opened&&this._overlayRef.updatePosition())}this.stateChanges.next(void 0)}ngOnDestroy(){this._destroyOverlay(),this.close(),this._inputStateChanges.unsubscribe(),this.stateChanges.complete()}select(e){this._model.add(e)}_selectYear(e){this.yearSelected.emit(e)}_selectMonth(e){this.monthSelected.emit(e)}_viewChanged(e){this.viewChanged.emit(e)}registerInput(e){return this.datepickerInput,this._inputStateChanges.unsubscribe(),this.datepickerInput=e,this._inputStateChanges=e.stateChanges.subscribe(()=>this.stateChanges.next(void 0)),this._model}registerActions(e){this._actionsPortal,this._actionsPortal=e,this._componentRef?.instance._assignActions(e,!0)}removeActions(e){e===this._actionsPortal&&(this._actionsPortal=null,this._componentRef?.instance._assignActions(null,!0))}open(){this._opened||this.disabled||this._componentRef?.instance._isAnimating||(this.datepickerInput,this._focusedElementBeforeOpen=St(),this._openOverlay(),this._opened=!0,this.openedStream.emit())}close(){if(!this._opened||this._componentRef?.instance._isAnimating)return;let e=this.restoreFocus&&this._focusedElementBeforeOpen&&typeof this._focusedElementBeforeOpen.focus=="function",t=()=>{this._opened&&(this._opened=!1,this.closedStream.emit())};if(this._componentRef){let{instance:i,location:r}=this._componentRef;i._animationDone.pipe(yn(1)).subscribe(()=>{let o=this._document.activeElement;e&&(!o||o===this._document.activeElement||r.nativeElement.contains(o))&&this._focusedElementBeforeOpen.focus(),this._focusedElementBeforeOpen=null,this._destroyOverlay()}),i._startExitAnimation()}e?setTimeout(t):t()}_applyPendingSelection(){this._componentRef?.instance?._applyPendingSelection()}_forwardContentValues(e){e.datepicker=this,e.color=this.color,e._dialogLabelId=this.datepickerInput.getOverlayLabelId(),e._assignActions(this._actionsPortal,!1)}_openOverlay(){this._destroyOverlay();let e=this.touchUi,t=new qe(Ha,this._viewContainerRef),i=this._overlayRef=Ne(this._injector,new rt({positionStrategy:e?this._getDialogStrategy():this._getDropdownStrategy(),hasBackdrop:!0,backdropClass:[e?"cdk-overlay-dark-backdrop":"mat-overlay-transparent-backdrop",this._backdropHarnessClass],direction:this._dir||"ltr",scrollStrategy:e?yi(this._injector):this._scrollStrategy(),panelClass:`mat-datepicker-${e?"dialog":"popup"}`,disableAnimations:this._animationsDisabled}));this._getCloseStream(i).subscribe(r=>{r&&r.preventDefault(),this.close()}),i.keydownEvents().subscribe(r=>{let o=r.keyCode;(o===38||o===40||o===37||o===39||o===33||o===34)&&r.preventDefault()}),this._componentRef=i.attach(t),this._forwardContentValues(this._componentRef.instance),e||fe(()=>{i.updatePosition()},{injector:this._injector})}_destroyOverlay(){this._overlayRef&&(this._overlayRef.dispose(),this._overlayRef=this._componentRef=null)}_getDialogStrategy(){return Ci(this._injector).centerHorizontally().centerVertically()}_getDropdownStrategy(){let e=Le(this._injector,this.datepickerInput.getConnectedOverlayOrigin()).withTransformOriginOn(".mat-datepicker-content").withFlexibleDimensions(!1).withViewportMargin(8).withLockedPosition();return this._setConnectedPositions(e)}_setConnectedPositions(e){let t=this.xPosition==="end"?"end":"start",i=t==="start"?"end":"start",r=this.yPosition==="above"?"bottom":"top",o=r==="top"?"bottom":"top";return e.withPositions([{originX:t,originY:o,overlayX:t,overlayY:r},{originX:t,originY:r,overlayX:t,overlayY:o},{originX:i,originY:o,overlayX:i,overlayY:r},{originX:i,originY:r,overlayX:i,overlayY:o}])}_getCloseStream(e){let t=["ctrlKey","shiftKey","metaKey"];return Ge(e.backdropClick(),e.detachments(),e.keydownEvents().pipe(we(i=>i.keyCode===27&&!de(i)||this.datepickerInput&&de(i,"altKey")&&i.keyCode===38&&t.every(r=>!de(i,r)))))}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,inputs:{calendarHeaderComponent:"calendarHeaderComponent",startAt:"startAt",startView:"startView",color:"color",touchUi:[2,"touchUi","touchUi",F],disabled:[2,"disabled","disabled",F],xPosition:"xPosition",yPosition:"yPosition",restoreFocus:[2,"restoreFocus","restoreFocus",F],dateClass:"dateClass",panelClass:"panelClass",opened:[2,"opened","opened",F]},outputs:{yearSelected:"yearSelected",monthSelected:"monthSelected",viewChanged:"viewChanged",openedStream:"opened",closedStream:"closed"},features:[ue]})}return n})(),Ya=(()=>{class n extends wi{static \u0275fac=(()=>{let e;return function(i){return(e||(e=Be(n)))(i||n)}})();static \u0275cmp=P({type:n,selectors:[["mat-datepicker"]],exportAs:["matDatepicker"],features:[q([La,{provide:wi,useExisting:n}]),ke],decls:0,vars:0,template:function(t,i){},encapsulation:2,changeDetection:0})}return n})(),gt=class{target;targetElement;value=null;constructor(a,e){this.target=a,this.targetElement=e,this.value=this.target.value}},ja=(()=>{class n{_elementRef=s(O);_dateAdapter=s(X,{optional:!0});_dateFormats=s(Ie,{optional:!0});_isInitialized=!1;get value(){return this._model?this._getValueFromModel(this._model.selection):this._pendingValue}set value(e){this._assignValueProgrammatically(e,!0)}_model;get disabled(){return!!this._disabled||this._parentDisabled()}set disabled(e){let t=e,i=this._elementRef.nativeElement;this._disabled!==t&&(this._disabled=t,this.stateChanges.next(void 0)),t&&this._isInitialized&&i.blur&&i.blur()}_disabled;dateChange=new D;dateInput=new D;stateChanges=new A;_onTouched=()=>{};_validatorOnChange=()=>{};_cvaOnChange=()=>{};_valueChangesSubscription=B.EMPTY;_localeSubscription=B.EMPTY;_pendingValue=null;_parseValidator=()=>this._lastValueValid?null:{matDatepickerParse:{text:this._elementRef.nativeElement.value}};_filterValidator=e=>{let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value));return!t||this._matchesFilter(t)?null:{matDatepickerFilter:!0}};_minValidator=e=>{let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value)),i=this._getMinDate();return!i||!t||this._dateAdapter.compareDate(i,t)<=0?null:{matDatepickerMin:{min:i,actual:t}}};_maxValidator=e=>{let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value)),i=this._getMaxDate();return!i||!t||this._dateAdapter.compareDate(i,t)>=0?null:{matDatepickerMax:{max:i,actual:t}}};_getValidators(){return[this._parseValidator,this._minValidator,this._maxValidator,this._filterValidator]}_registerModel(e){this._model=e,this._valueChangesSubscription.unsubscribe(),this._pendingValue&&this._assignValue(this._pendingValue),this._valueChangesSubscription=this._model.selectionChanged.subscribe(t=>{if(this._shouldHandleChangeEvent(t)){let i=this._getValueFromModel(t.selection);this._lastValueValid=this._isValidValue(i),this._cvaOnChange(i),this._onTouched(),this._formatValue(i),this.dateInput.emit(new gt(this,this._elementRef.nativeElement)),this.dateChange.emit(new gt(this,this._elementRef.nativeElement))}})}_lastValueValid=!1;constructor(){this._localeSubscription=this._dateAdapter.localeChanges.subscribe(()=>{this._assignValueProgrammatically(this.value,!0)})}ngAfterViewInit(){this._isInitialized=!0}ngOnChanges(e){Wa(e,this._dateAdapter)&&this.stateChanges.next(void 0)}ngOnDestroy(){this._valueChangesSubscription.unsubscribe(),this._localeSubscription.unsubscribe(),this.stateChanges.complete()}registerOnValidatorChange(e){this._validatorOnChange=e}validate(e){return this._validator?this._validator(e):null}writeValue(e){this._assignValueProgrammatically(e,e!==this.value)}registerOnChange(e){this._cvaOnChange=e}registerOnTouched(e){this._onTouched=e}setDisabledState(e){this.disabled=e}_onKeydown(e){let t=["ctrlKey","shiftKey","metaKey"];de(e,"altKey")&&e.keyCode===40&&t.every(r=>!de(e,r))&&!this._elementRef.nativeElement.readOnly&&(this._openPopup(),e.preventDefault())}_onInput(e){let t=e.target.value,i=this._lastValueValid,r=this._dateAdapter.parse(t,this._dateFormats.parse.dateInput);this._lastValueValid=this._isValidValue(r),r=this._dateAdapter.getValidDateOrNull(r);let o=!this._dateAdapter.sameDate(r,this.value);!r||o?this._cvaOnChange(r):(t&&!this.value&&this._cvaOnChange(r),i!==this._lastValueValid&&this._validatorOnChange()),o&&(this._assignValue(r),this.dateInput.emit(new gt(this,this._elementRef.nativeElement)))}_onChange(){this.dateChange.emit(new gt(this,this._elementRef.nativeElement))}_onBlur(){this.value&&this._formatValue(this.value),this._onTouched()}_formatValue(e){this._elementRef.nativeElement.value=e!=null?this._dateAdapter.format(e,this._dateFormats.display.dateInput):""}_assignValue(e){this._model?(this._assignValueToModel(e),this._pendingValue=null):this._pendingValue=e}_isValidValue(e){return!e||this._dateAdapter.isValid(e)}_parentDisabled(){return!1}_assignValueProgrammatically(e,t){e=this._dateAdapter.deserialize(e),this._lastValueValid=this._isValidValue(e),e=this._dateAdapter.getValidDateOrNull(e),this._assignValue(e),t&&this._formatValue(e)}_matchesFilter(e){let t=this._getDateFilter();return!t||t(e)}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,inputs:{value:"value",disabled:[2,"disabled","disabled",F]},outputs:{dateChange:"dateChange",dateInput:"dateInput"},features:[ue]})}return n})();function Wa(n,a){let e=Object.keys(n);for(let t of e){let{previousValue:i,currentValue:r}=n[t];if(a.isDateInstance(i)&&a.isDateInstance(r)){if(!a.sameDate(i,r))return!0}else return!0}return!1}var So={provide:je,useExisting:dt(()=>Si),multi:!0},Eo={provide:ut,useExisting:dt(()=>Si),multi:!0},Si=(()=>{class n extends ja{_formField=s(We,{optional:!0});_closedSubscription=B.EMPTY;_openedSubscription=B.EMPTY;set matDatepicker(e){e&&(this._datepicker=e,this._ariaOwns.set(e.opened?e.id:null),this._closedSubscription=e.closedStream.subscribe(()=>{this._onTouched(),this._ariaOwns.set(null)}),this._openedSubscription=e.openedStream.subscribe(()=>{this._ariaOwns.set(e.id)}),this._registerModel(e.registerInput(this)))}_datepicker;_ariaOwns=E(null);get min(){return this._min}set min(e){let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e));this._dateAdapter.sameDate(t,this._min)||(this._min=t,this._validatorOnChange())}_min=null;get max(){return this._max}set max(e){let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e));this._dateAdapter.sameDate(t,this._max)||(this._max=t,this._validatorOnChange())}_max=null;get dateFilter(){return this._dateFilter}set dateFilter(e){let t=this._matchesFilter(this.value);this._dateFilter=e,this._matchesFilter(this.value)!==t&&this._validatorOnChange()}_dateFilter;_validator=null;constructor(){super(),this._validator=Re.compose(super._getValidators())}getConnectedOverlayOrigin(){return this._formField?this._formField.getConnectedOverlayOrigin():this._elementRef}getOverlayLabelId(){return this._formField?this._formField.getLabelId():this._elementRef.nativeElement.getAttribute("aria-labelledby")}getThemePalette(){return this._formField?this._formField.color:void 0}getStartValue(){return this.value}ngOnDestroy(){super.ngOnDestroy(),this._closedSubscription.unsubscribe(),this._openedSubscription.unsubscribe()}_openPopup(){this._datepicker&&this._datepicker.open()}_getValueFromModel(e){return e}_assignValueToModel(e){this._model&&this._model.updateSelection(e,this)}_getMinDate(){return this._min}_getMaxDate(){return this._max}_getDateFilter(){return this._dateFilter}_shouldHandleChangeEvent(e){return e.source!==this}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["input","matDatepicker",""]],hostAttrs:[1,"mat-datepicker-input"],hostVars:6,hostBindings:function(t,i){t&1&&_("input",function(o){return i._onInput(o)})("change",function(){return i._onChange()})("blur",function(){return i._onBlur()})("keydown",function(o){return i._onKeydown(o)}),t&2&&(oe("disabled",i.disabled),w("aria-haspopup",i._datepicker?"dialog":null)("aria-owns",i._ariaOwns())("min",i.min?i._dateAdapter.toIso8601(i.min):null)("max",i.max?i._dateAdapter.toIso8601(i.max):null)("data-mat-calendar",i._datepicker?i._datepicker.id:null))},inputs:{matDatepicker:"matDatepicker",min:"min",max:"max",dateFilter:[0,"matDatepickerFilter","dateFilter"]},exportAs:["matDatepickerInput"],features:[q([So,Eo,{provide:ft,useExisting:n}]),ke]})}return n})(),Ao=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["","matDatepickerToggleIcon",""]]})}return n})(),Oo=(()=>{class n{_intl=s(xt);_changeDetectorRef=s(Z);_stateChanges=B.EMPTY;datepicker;tabIndex=null;ariaLabel;get disabled(){return this._disabled===void 0&&this.datepicker?this.datepicker.disabled:!!this._disabled}set disabled(e){this._disabled=e}_disabled;disableRipple=!1;_customIcon;_button;constructor(){let e=s(new $t("tabindex"),{optional:!0}),t=Number(e);this.tabIndex=t||t===0?t:null}ngOnChanges(e){e.datepicker&&this._watchStateChanges()}ngOnDestroy(){this._stateChanges.unsubscribe()}ngAfterContentInit(){this._watchStateChanges()}_open(e){this.datepicker&&!this.disabled&&(this.datepicker.open(),e.stopPropagation())}_watchStateChanges(){let e=this.datepicker?this.datepicker.stateChanges:lt(),t=this.datepicker&&this.datepicker.datepickerInput?this.datepicker.datepickerInput.stateChanges:lt(),i=this.datepicker?Ge(this.datepicker.openedStream,this.datepicker.closedStream):lt();this._stateChanges.unsubscribe(),this._stateChanges=Ge(this._intl.changes,e,t,i).subscribe(()=>this._changeDetectorRef.markForCheck())}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-datepicker-toggle"]],contentQueries:function(t,i,r){if(t&1&&Ht(r,Ao,5),t&2){let o;I(o=V())&&(i._customIcon=o.first)}},viewQuery:function(t,i){if(t&1&&me(uo,5),t&2){let r;I(r=V())&&(i._button=r.first)}},hostAttrs:[1,"mat-datepicker-toggle"],hostVars:8,hostBindings:function(t,i){t&1&&_("click",function(o){return i._open(o)}),t&2&&(w("tabindex",null)("data-mat-calendar",i.datepicker?i.datepicker.id:null),k("mat-datepicker-toggle-active",i.datepicker&&i.datepicker.opened)("mat-accent",i.datepicker&&i.datepicker.color==="accent")("mat-warn",i.datepicker&&i.datepicker.color==="warn"))},inputs:{datepicker:[0,"for","datepicker"],tabIndex:"tabIndex",ariaLabel:[0,"aria-label","ariaLabel"],disabled:[2,"disabled","disabled",F],disableRipple:"disableRipple"},exportAs:["matDatepickerToggle"],features:[ue],ngContentSelectors:ho,decls:4,vars:7,consts:[["button",""],["matIconButton","","type","button",3,"tabIndex","disabled","disableRipple"],["viewBox","0 0 24 24","width","24px","height","24px","fill","currentColor","focusable","false","aria-hidden","true",1,"mat-datepicker-toggle-default-icon"],["d","M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"]],template:function(t,i){t&1&&(ge(mo),c(0,"button",1,0),C(2,_o,2,0,":svg:svg",2),H(3),u()),t&2&&(g("tabIndex",i.disabled?-1:i.tabIndex)("disabled",i.disabled)("disableRipple",i.disableRipple),w("aria-haspopup",i.datepicker?"dialog":null)("aria-label",i.ariaLabel||i._intl.openCalendarLabel)("aria-expanded",i.datepicker?i.datepicker.opened:null),l(2),x(i._customIcon?-1:2))},dependencies:[Ot],styles:[`.mat-datepicker-toggle {
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
`],encapsulation:2,changeDetection:0})}return n})(),mn=(()=>{class n{_changeDetectorRef=s(Z);_elementRef=s(O);_dateAdapter=s(X,{optional:!0});_formField=s(We,{optional:!0});_closedSubscription=B.EMPTY;_openedSubscription=B.EMPTY;_startInput;_endInput;get value(){return this._model?this._model.selection:null}id=s(ce).getId("mat-date-range-input-");focused=!1;get shouldLabelFloat(){return this.focused||!this.empty}controlType="mat-date-range-input";get placeholder(){let e=this._startInput?._getPlaceholder()||"",t=this._endInput?._getPlaceholder()||"";return e||t?`${e} ${this.separator} ${t}`:""}get rangePicker(){return this._rangePicker}set rangePicker(e){e&&(this._model=e.registerInput(this),this._rangePicker=e,this._closedSubscription.unsubscribe(),this._openedSubscription.unsubscribe(),this._ariaOwns.set(this.rangePicker.opened?e.id:null),this._closedSubscription=e.closedStream.subscribe(()=>{this._startInput?._onTouched(),this._endInput?._onTouched(),this._ariaOwns.set(null)}),this._openedSubscription=e.openedStream.subscribe(()=>{this._ariaOwns.set(e.id)}),this._registerModel(this._model))}_rangePicker;_ariaOwns=E(null);get required(){return this._required??(this._isTargetRequired(this)||this._isTargetRequired(this._startInput)||this._isTargetRequired(this._endInput))??!1}set required(e){this._required=e}_required;get dateFilter(){return this._dateFilter}set dateFilter(e){let t=this._startInput,i=this._endInput,r=t&&t._matchesFilter(t.value),o=i&&i._matchesFilter(t.value);this._dateFilter=e,t&&t._matchesFilter(t.value)!==r&&t._validatorOnChange(),i&&i._matchesFilter(i.value)!==o&&i._validatorOnChange()}_dateFilter;get min(){return this._min}set min(e){let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e));this._dateAdapter.sameDate(t,this._min)||(this._min=t,this._revalidate())}_min=null;get max(){return this._max}set max(e){let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e));this._dateAdapter.sameDate(t,this._max)||(this._max=t,this._revalidate())}_max=null;get disabled(){return this._startInput&&this._endInput?this._startInput.disabled&&this._endInput.disabled:this._groupDisabled}set disabled(e){e!==this._groupDisabled&&(this._groupDisabled=e,this.stateChanges.next(void 0))}_groupDisabled=!1;get errorState(){return this._startInput&&this._endInput?this._startInput.errorState||this._endInput.errorState:!1}get empty(){let e=this._startInput?this._startInput.isEmpty():!1,t=this._endInput?this._endInput.isEmpty():!1;return e&&t}_ariaDescribedBy=null;_model;separator="\u2013";comparisonStart=null;comparisonEnd=null;ngControl;stateChanges=new A;disableAutomaticLabeling=!0;constructor(){this._dateAdapter,this._formField?._elementRef.nativeElement.classList.contains("mat-mdc-form-field")&&this._elementRef.nativeElement.classList.add("mat-mdc-input-element","mat-mdc-form-field-input-control","mdc-text-field__input"),this.ngControl=s(Fn,{optional:!0,self:!0})}get describedByIds(){return this._elementRef.nativeElement.getAttribute("aria-describedby")?.split(" ")||[]}setDescribedByIds(e){this._ariaDescribedBy=e.length?e.join(" "):null}onContainerClick(){!this.focused&&!this.disabled&&(!this._model||!this._model.selection.start?this._startInput.focus():this._endInput.focus())}ngAfterContentInit(){this._model&&this._registerModel(this._model),Ge(this._startInput.stateChanges,this._endInput.stateChanges).subscribe(()=>{this.stateChanges.next(void 0)})}ngOnChanges(e){Wa(e,this._dateAdapter)&&this.stateChanges.next(void 0)}ngOnDestroy(){this._closedSubscription.unsubscribe(),this._openedSubscription.unsubscribe(),this.stateChanges.complete()}getStartValue(){return this.value?this.value.start:null}getThemePalette(){return this._formField?this._formField.color:void 0}getConnectedOverlayOrigin(){return this._formField?this._formField.getConnectedOverlayOrigin():this._elementRef}getOverlayLabelId(){return this._formField?this._formField.getLabelId():null}_getInputMirrorValue(e){let t=e==="start"?this._startInput:this._endInput;return t?t.getMirrorValue():""}_shouldHidePlaceholders(){return this._startInput?!this._startInput.isEmpty():!1}_handleChildValueChange(){this.stateChanges.next(void 0),this._changeDetectorRef.markForCheck()}_openDatepicker(){this._rangePicker&&this._rangePicker.open()}_shouldHideSeparator(){return(!this._formField||this._formField.getLabelId()&&!this._formField._shouldLabelFloat())&&this.empty}_getAriaLabelledby(){let e=this._formField;return e&&e._hasFloatingLabel()?e._labelId:null}_getStartDateAccessibleName(){return this._startInput._getAccessibleName()}_getEndDateAccessibleName(){return this._endInput._getAccessibleName()}_updateFocus(e){this.focused=e!==null,this.stateChanges.next()}_revalidate(){this._startInput&&this._startInput._validatorOnChange(),this._endInput&&this._endInput._validatorOnChange()}_registerModel(e){this._startInput&&this._startInput._registerModel(e),this._endInput&&this._endInput._registerModel(e)}_isTargetRequired(e){return e?.ngControl?.control?.hasValidator(Re.required)}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-date-range-input"]],hostAttrs:["role","group",1,"mat-date-range-input"],hostVars:8,hostBindings:function(t,i){t&2&&(w("id",i.id)("aria-labelledby",i._getAriaLabelledby())("aria-describedby",i._ariaDescribedBy)("data-mat-calendar",i.rangePicker?i.rangePicker.id:null),k("mat-date-range-input-hide-placeholders",i._shouldHidePlaceholders())("mat-date-range-input-required",i.required))},inputs:{rangePicker:"rangePicker",required:[2,"required","required",F],dateFilter:"dateFilter",min:"min",max:"max",disabled:[2,"disabled","disabled",F],separator:"separator",comparisonStart:"comparisonStart",comparisonEnd:"comparisonEnd"},exportAs:["matDateRangeInput"],features:[q([{provide:Pt,useExisting:n}]),ue],ngContentSelectors:go,decls:11,vars:5,consts:[["cdkMonitorSubtreeFocus","",1,"mat-date-range-input-container",3,"cdkFocusChange"],[1,"mat-date-range-input-wrapper"],["aria-hidden","true",1,"mat-date-range-input-mirror"],[1,"mat-date-range-input-separator"],[1,"mat-date-range-input-wrapper","mat-date-range-input-end-wrapper"]],template:function(t,i){t&1&&(ge(fo),c(0,"div",0),_("cdkFocusChange",function(o){return i._updateFocus(o)}),c(1,"div",1),H(2),c(3,"span",2),b(4),u()(),c(5,"span",3),b(6),u(),c(7,"div",4),H(8,1),c(9,"span",2),b(10),u()()()),t&2&&(l(4),M(i._getInputMirrorValue("start")),l(),k("mat-date-range-input-separator-hidden",i._shouldHideSeparator()),l(),M(i.separator),l(4),M(i._getInputMirrorValue("end")))},dependencies:[Ni],styles:[`.mat-date-range-input {
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
`],encapsulation:2,changeDetection:0})}return n})();function Po(n){return cn(n,!0)}function Va(n){return n.nodeType===Node.ELEMENT_NODE}function To(n){return n.nodeName==="INPUT"}function Ro(n){return n.nodeName==="TEXTAREA"}function cn(n,a){if(Va(n)&&a){let t=(n.getAttribute?.("aria-labelledby")?.split(/\s+/g)||[]).reduce((i,r)=>{let o=document.getElementById(r);return o&&i.push(o),i},[]);if(t.length)return t.map(i=>cn(i,!1)).join(" ")}if(Va(n)){let e=n.getAttribute("aria-label")?.trim();if(e)return e}if(To(n)||Ro(n)){if(n.labels?.length)return Array.from(n.labels).map(i=>cn(i,!1)).join(" ");let e=n.getAttribute("placeholder")?.trim();if(e)return e;let t=n.getAttribute("title")?.trim();if(t)return t}return(n.textContent||"").replace(/\s+/g," ").trim()}var qa=(()=>{class n extends ja{_rangeInput=s(mn);_elementRef=s(O);_defaultErrorStateMatcher=s(oi);_injector=s(j);_rawValue=E("");_parentForm=s(Jt,{optional:!0});_parentFormGroup=s(ti,{optional:!0});ngControl;_dir=s(se,{optional:!0});_errorStateTracker;get errorStateMatcher(){return this._errorStateTracker.matcher}set errorStateMatcher(e){this._errorStateTracker.matcher=e}get errorState(){return this._errorStateTracker.errorState}set errorState(e){this._errorStateTracker.errorState=e}constructor(){super(),this._errorStateTracker=new li(this._defaultErrorStateMatcher,null,this._parentFormGroup,this._parentForm,this.stateChanges)}ngOnInit(){let e=this._injector.get(Zt,null,{optional:!0,self:!0});e&&(this.ngControl=e,this._errorStateTracker.ngControl=e)}ngAfterContentInit(){this._register()}ngDoCheck(){this.ngControl&&this.updateErrorState(),this._rawValue.set(this._elementRef.nativeElement.value)}isEmpty(){return this._rawValue().length===0}_getPlaceholder(){return this._elementRef.nativeElement.placeholder}focus(){this._elementRef.nativeElement.focus()}getMirrorValue(){let e=this._rawValue();return e.length>0?e:this._getPlaceholder()}updateErrorState(){this._errorStateTracker.updateErrorState()}_onInput(e){super._onInput(e),this._rangeInput._handleChildValueChange()}_openPopup(){this._rangeInput._openDatepicker()}_getMinDate(){return this._rangeInput.min}_getMaxDate(){return this._rangeInput.max}_getDateFilter(){return this._rangeInput.dateFilter}_parentDisabled(){return this._rangeInput._groupDisabled}_shouldHandleChangeEvent({source:e}){return e!==this._rangeInput._startInput&&e!==this._rangeInput._endInput}_assignValueProgrammatically(e,t){super._assignValueProgrammatically(e,t),(this===this._rangeInput._startInput?this._rangeInput._endInput:this._rangeInput._startInput)?._validatorOnChange(),this._rawValue.set(this._elementRef.nativeElement.value)}_formatValue(e){super._formatValue(e),this._rangeInput._handleChildValueChange()}_getAccessibleName(){return Po(this._elementRef.nativeElement)}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,inputs:{errorStateMatcher:"errorStateMatcher"},features:[ke]})}return n})(),Xa=(()=>{class n extends qa{_startValidator=e=>{let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value)),i=this._model?this._model.selection.end:null;return!t||!i||this._dateAdapter.compareDate(t,i)<=0?null:{matStartDateInvalid:{end:i,actual:t}}};_validator=Re.compose([...super._getValidators(),this._startValidator]);_register(){this._rangeInput._startInput=this}_getValueFromModel(e){return e.start}_shouldHandleChangeEvent(e){return super._shouldHandleChangeEvent(e)?e.oldValue?.start?!e.selection.start||!!this._dateAdapter.compareDate(e.oldValue.start,e.selection.start):!!e.selection.start:!1}_assignValueToModel(e){if(this._model){let t=new $(e,this._model.selection.end);this._model.updateSelection(t,this),this._rangeInput._handleChildValueChange()}}_onKeydown(e){let t=this._rangeInput._endInput,i=this._elementRef.nativeElement,r=this._dir?.value!=="rtl";(e.keyCode===39&&r||e.keyCode===37&&!r)&&i.selectionStart===i.value.length&&i.selectionEnd===i.value.length?(e.preventDefault(),t._elementRef.nativeElement.setSelectionRange(0,0),t.focus()):super._onKeydown(e)}static \u0275fac=(()=>{let e;return function(i){return(e||(e=Be(n)))(i||n)}})();static \u0275dir=T({type:n,selectors:[["input","matStartDate",""]],hostAttrs:["type","text",1,"mat-start-date","mat-date-range-input-inner"],hostVars:5,hostBindings:function(t,i){t&1&&_("input",function(o){return i._onInput(o)})("change",function(){return i._onChange()})("keydown",function(o){return i._onKeydown(o)})("blur",function(){return i._onBlur()}),t&2&&(oe("disabled",i.disabled),w("aria-haspopup",i._rangeInput.rangePicker?"dialog":null)("aria-owns",i._rangeInput._ariaOwns()||null)("min",i._getMinDate()?i._dateAdapter.toIso8601(i._getMinDate()):null)("max",i._getMaxDate()?i._dateAdapter.toIso8601(i._getMaxDate()):null))},outputs:{dateChange:"dateChange",dateInput:"dateInput"},features:[q([{provide:je,useExisting:n,multi:!0},{provide:ut,useExisting:n,multi:!0}]),ke]})}return n})(),$a=(()=>{class n extends qa{_endValidator=e=>{let t=this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value)),i=this._model?this._model.selection.start:null;return!t||!i||this._dateAdapter.compareDate(t,i)>=0?null:{matEndDateInvalid:{start:i,actual:t}}};_register(){this._rangeInput._endInput=this}_validator=Re.compose([...super._getValidators(),this._endValidator]);_getValueFromModel(e){return e.end}_shouldHandleChangeEvent(e){return super._shouldHandleChangeEvent(e)?e.oldValue?.end?!e.selection.end||!!this._dateAdapter.compareDate(e.oldValue.end,e.selection.end):!!e.selection.end:!1}_assignValueToModel(e){if(this._model){let t=new $(this._model.selection.start,e);this._model.updateSelection(t,this)}}_moveCaretToEndOfStartInput(){let e=this._rangeInput._startInput._elementRef.nativeElement,t=e.value;t.length>0&&e.setSelectionRange(t.length,t.length),e.focus()}_onKeydown(e){let t=this._elementRef.nativeElement,i=this._dir?.value!=="rtl";e.keyCode===8&&!t.value?this._moveCaretToEndOfStartInput():(e.keyCode===37&&i||e.keyCode===39&&!i)&&t.selectionStart===0&&t.selectionEnd===0?(e.preventDefault(),this._moveCaretToEndOfStartInput()):super._onKeydown(e)}static \u0275fac=(()=>{let e;return function(i){return(e||(e=Be(n)))(i||n)}})();static \u0275dir=T({type:n,selectors:[["input","matEndDate",""]],hostAttrs:["type","text",1,"mat-end-date","mat-date-range-input-inner"],hostVars:5,hostBindings:function(t,i){t&1&&_("input",function(o){return i._onInput(o)})("change",function(){return i._onChange()})("keydown",function(o){return i._onKeydown(o)})("blur",function(){return i._onBlur()}),t&2&&(oe("disabled",i.disabled),w("aria-haspopup",i._rangeInput.rangePicker?"dialog":null)("aria-owns",i._rangeInput._ariaOwns()||null)("min",i._getMinDate()?i._dateAdapter.toIso8601(i._getMinDate()):null)("max",i._getMaxDate()?i._dateAdapter.toIso8601(i._getMaxDate()):null))},outputs:{dateChange:"dateChange",dateInput:"dateInput"},features:[q([{provide:je,useExisting:n,multi:!0},{provide:ut,useExisting:n,multi:!0}]),ke]})}return n})(),Ka=(()=>{class n extends wi{_forwardContentValues(e){super._forwardContentValues(e);let t=this.datepickerInput;t&&(e.comparisonStart=t.comparisonStart,e.comparisonEnd=t.comparisonEnd,e.startDateAccessibleName=t._getStartDateAccessibleName(),e.endDateAccessibleName=t._getEndDateAccessibleName())}static \u0275fac=(()=>{let e;return function(i){return(e||(e=Be(n)))(i||n)}})();static \u0275cmp=P({type:n,selectors:[["mat-date-range-picker"]],exportAs:["matDateRangePicker"],features:[q([xo,{provide:Di,useFactory:()=>s(Di,{optional:!0,skipSelf:!0})||new Do(s(X))},{provide:wi,useExisting:n}]),ke],decls:0,vars:0,template:function(t,i){},encapsulation:2,changeDetection:0})}return n})();var Ua=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=G({type:n});static \u0275inj=U({providers:[xt],imports:[Zn,en,jn,mi,Ha,Oo,za,De,nt]})}return n})();var Ft=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=G({type:n});static \u0275inj=U({imports:[Hn,ci,De]})}return n})();var Fo=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["ng-component"]],hostAttrs:["cdk-text-field-style-loader",""],decls:0,vars:0,template:function(t,i){},styles:[`textarea.cdk-textarea-autosize {
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
`],encapsulation:2,changeDetection:0})}return n})(),Lo={passive:!0},Ga=(()=>{class n{_platform=s(Q);_ngZone=s(L);_renderer=s(Oe).createRenderer(null,null);_styleLoader=s(Me);_monitoredElements=new Map;constructor(){}monitor(e){if(!this._platform.isBrowser)return bn;this._styleLoader.load(Fo);let t=At(e),i=this._monitoredElements.get(t);if(i)return i.subject;let r=new A,o="cdk-text-field-autofilled",p=y=>{y.animationName==="cdk-text-field-autofill-start"&&!t.classList.contains(o)?(t.classList.add(o),this._ngZone.run(()=>r.next({target:y.target,isAutofilled:!0}))):y.animationName==="cdk-text-field-autofill-end"&&t.classList.contains(o)&&(t.classList.remove(o),this._ngZone.run(()=>r.next({target:y.target,isAutofilled:!1})))},f=this._ngZone.runOutsideAngular(()=>(t.classList.add("cdk-text-field-autofill-monitored"),this._renderer.listen(t,"animationstart",p,Lo)));return this._monitoredElements.set(t,{subject:r,unlisten:f}),r}stopMonitoring(e){let t=At(e),i=this._monitoredElements.get(t);i&&(i.unlisten(),i.subject.complete(),t.classList.remove("cdk-text-field-autofill-monitored"),t.classList.remove("cdk-text-field-autofilled"),this._monitoredElements.delete(t))}ngOnDestroy(){this._monitoredElements.forEach((e,t)=>this.stopMonitoring(t))}static \u0275fac=function(t){return new(t||n)};static \u0275prov=z({token:n,factory:n.\u0275fac,providedIn:"root"})}return n})();var Za=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=G({type:n});static \u0275inj=U({})}return n})();var No=["button","checkbox","file","hidden","image","radio","range","reset","submit"],Bo=new N("MAT_INPUT_CONFIG"),Qa=(()=>{class n{_elementRef=s(O);_platform=s(Q);ngControl=s(Zt,{optional:!0,self:!0});_autofillMonitor=s(Ga);_ngZone=s(L);_formField=s(We,{optional:!0});_renderer=s(ae);_uid=s(ce).getId("mat-input-");_previousNativeValue;_inputValueAccessor;_signalBasedValueAccessor;_previousPlaceholder=null;_errorStateTracker;_config=s(Bo,{optional:!0});_cleanupIosKeyup;_cleanupWebkitWheel;_isServer=!1;_isNativeSelect=!1;_isTextarea=!1;_isInFormField=!1;focused=!1;stateChanges=new A;controlType="mat-input";autofilled=!1;get disabled(){return this._disabled}set disabled(e){this._disabled=Ve(e),this.focused&&(this.focused=!1,this.stateChanges.next())}_disabled=!1;get id(){return this._id}set id(e){this._id=e||this._uid}_id;placeholder;name;get required(){return this._required??this.ngControl?.control?.hasValidator(Re.required)??!1}set required(e){this._required=Ve(e)}_required;get type(){return this._type}set type(e){this._type=e||"text",this._validateType(),!this._isTextarea&&zi().has(this._type)&&(this._elementRef.nativeElement.type=this._type)}_type="text";get errorStateMatcher(){return this._errorStateTracker.matcher}set errorStateMatcher(e){this._errorStateTracker.matcher=e}userAriaDescribedBy;get value(){return this._signalBasedValueAccessor?this._signalBasedValueAccessor.value():this._inputValueAccessor.value}set value(e){e!==this.value&&(this._signalBasedValueAccessor?this._signalBasedValueAccessor.value.set(e):this._inputValueAccessor.value=e,this.stateChanges.next())}get readonly(){return this._readonly}set readonly(e){this._readonly=Ve(e)}_readonly=!1;disabledInteractive;get errorState(){return this._errorStateTracker.errorState}set errorState(e){this._errorStateTracker.errorState=e}_neverEmptyInputTypes=["date","datetime","datetime-local","month","time","week"].filter(e=>zi().has(e));constructor(){let e=s(Jt,{optional:!0}),t=s(ti,{optional:!0}),i=s(oi),r=s(ft,{optional:!0,self:!0}),o=this._elementRef.nativeElement,p=o.nodeName.toLowerCase();r?kn(r.value)?this._signalBasedValueAccessor=r:this._inputValueAccessor=r:this._inputValueAccessor=o,this._previousNativeValue=this.value,this.id=this.id,this._platform.IOS&&this._ngZone.runOutsideAngular(()=>{this._cleanupIosKeyup=this._renderer.listen(o,"keyup",this._iOSKeyupListener)}),this._errorStateTracker=new li(i,this.ngControl,t,e,this.stateChanges),this._isServer=!this._platform.isBrowser,this._isNativeSelect=p==="select",this._isTextarea=p==="textarea",this._isInFormField=!!this._formField,this.disabledInteractive=this._config?.disabledInteractive||!1,this._isNativeSelect&&(this.controlType=o.multiple?"mat-native-select-multiple":"mat-native-select"),this._signalBasedValueAccessor&&Ae(()=>{this._signalBasedValueAccessor.value(),this.stateChanges.next()})}ngAfterViewInit(){this._platform.isBrowser&&this._autofillMonitor.monitor(this._elementRef.nativeElement).subscribe(e=>{this.autofilled=e.isAutofilled,this.stateChanges.next()})}ngOnChanges(){this.stateChanges.next()}ngOnDestroy(){this.stateChanges.complete(),this._platform.isBrowser&&this._autofillMonitor.stopMonitoring(this._elementRef.nativeElement),this._cleanupIosKeyup?.(),this._cleanupWebkitWheel?.()}ngDoCheck(){this.ngControl&&(this.updateErrorState(),this.ngControl.disabled!==null&&this.ngControl.disabled!==this.disabled&&(this.disabled=this.ngControl.disabled,this.stateChanges.next())),this._dirtyCheckNativeValue(),this._dirtyCheckPlaceholder()}focus(e){this._elementRef.nativeElement.focus(e)}updateErrorState(){this._errorStateTracker.updateErrorState()}_focusChanged(e){if(e!==this.focused){if(!this._isNativeSelect&&e&&this.disabled&&this.disabledInteractive){let t=this._elementRef.nativeElement;t.type==="number"?(t.type="text",t.setSelectionRange(0,0),t.type="number"):t.setSelectionRange(0,0)}this.focused=e,this.stateChanges.next()}}_onInput(){}_dirtyCheckNativeValue(){let e=this._elementRef.nativeElement.value;this._previousNativeValue!==e&&(this._previousNativeValue=e,this.stateChanges.next())}_dirtyCheckPlaceholder(){let e=this._getPlaceholder();if(e!==this._previousPlaceholder){let t=this._elementRef.nativeElement;this._previousPlaceholder=e,e?t.setAttribute("placeholder",e):t.removeAttribute("placeholder")}}_getPlaceholder(){return this.placeholder||null}_validateType(){No.indexOf(this._type)>-1}_isNeverEmpty(){return this._neverEmptyInputTypes.indexOf(this._type)>-1}_isBadInput(){let e=this._elementRef.nativeElement.validity;return e&&e.badInput}get empty(){return!this._isNeverEmpty()&&!this._elementRef.nativeElement.value&&!this._isBadInput()&&!this.autofilled}get shouldLabelFloat(){if(this._isNativeSelect){let e=this._elementRef.nativeElement,t=e.options[0];return this.focused||e.multiple||!this.empty||!!(e.selectedIndex>-1&&t&&t.label)}else return this.focused&&!this.disabled||!this.empty}get describedByIds(){return this._elementRef.nativeElement.getAttribute("aria-describedby")?.split(" ")||[]}setDescribedByIds(e){let t=this._elementRef.nativeElement;e.length?t.setAttribute("aria-describedby",e.join(" ")):t.removeAttribute("aria-describedby")}onContainerClick(){this.focused||this.focus()}_isInlineSelect(){let e=this._elementRef.nativeElement;return this._isNativeSelect&&(e.multiple||e.size>1)}_iOSKeyupListener=e=>{let t=e.target;!t.value&&t.selectionStart===0&&t.selectionEnd===0&&(t.setSelectionRange(1,1),t.setSelectionRange(0,0))};_getReadonlyAttribute(){return this._isNativeSelect?null:this.readonly||this.disabled&&this.disabledInteractive?"true":null}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["input","matInput",""],["textarea","matInput",""],["select","matNativeControl",""],["input","matNativeControl",""],["textarea","matNativeControl",""]],hostAttrs:[1,"mat-mdc-input-element"],hostVars:21,hostBindings:function(t,i){t&1&&_("focus",function(){return i._focusChanged(!0)})("blur",function(){return i._focusChanged(!1)})("input",function(){return i._onInput()}),t&2&&(oe("id",i.id)("disabled",i.disabled&&!i.disabledInteractive)("required",i.required),w("name",i.name||null)("readonly",i._getReadonlyAttribute())("aria-disabled",i.disabled&&i.disabledInteractive?"true":null)("aria-invalid",i.empty&&i.required?null:i.errorState)("aria-required",i.required)("id",i.id),k("mat-input-server",i._isServer)("mat-mdc-form-field-textarea-control",i._isInFormField&&i._isTextarea)("mat-mdc-form-field-input-control",i._isInFormField)("mat-mdc-input-disabled-interactive",i.disabledInteractive)("mdc-text-field__input",i._isInFormField)("mat-mdc-native-select-inline",i._isInlineSelect()))},inputs:{disabled:"disabled",id:"id",placeholder:"placeholder",name:"name",required:"required",type:"type",errorStateMatcher:"errorStateMatcher",userAriaDescribedBy:[0,"aria-describedby","userAriaDescribedBy"],value:"value",readonly:"readonly",disabledInteractive:[2,"disabledInteractive","disabledInteractive",F]},exportAs:["matInput"],features:[q([{provide:Pt,useExisting:n}]),ue]})}return n})(),Ja=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=G({type:n});static \u0275inj=U({imports:[Ft,Ft,Za,De]})}return n})();var Yo=["panelTemplate"],jo=(n,a)=>a.value;function Wo(n,a){if(n&1){let e=R();c(0,"mat-option",3),_("onSelectionChange",function(i){m(e);let r=d(2);return h(r._selectValue(i.source))}),b(1),u()}if(n&2){let e=a.$implicit;g("value",e.value),l(),M(e.label)}}function qo(n,a){if(n&1){let e=R();c(0,"div",1),_("animationend",function(i){m(e);let r=d();return h(r._handleAnimationEnd(i))}),ye(1,Wo,2,2,"mat-option",2,jo),u()}if(n&2){let e=d();k("mat-timepicker-panel-animations-enabled",!e._animationsDisabled)("mat-timepicker-panel-exit",!e.isOpen()),g("id",e.panelId),w("aria-label",e.ariaLabel()||null)("aria-labelledby",e._getAriaLabelledby()),l(),Ce(e._timeOptions)}}var Xo=[[["","matTimepickerToggleIcon",""]]],$o=["[matTimepickerToggleIcon]"];function Ko(n,a){n&1&&(Qe(),c(0,"svg",1),J(1,"path",2),u())}var Uo=/^(\d*\.?\d+)\s*(h|hour|hours|m|min|minute|minutes|s|second|seconds)?$/i,tr=new N("MAT_TIMEPICKER_CONFIG");function er(n){let a;if(n===null)return null;if(typeof n=="number")a=n;else{if(n.trim().length===0)return null;let e=n.match(Uo),t=e?parseFloat(e[1]):null,i=e?.[2]?.toLowerCase()||null;if(!e||t===null||isNaN(t))return null;i==="h"||i==="hour"||i==="hours"?a=t*3600:i==="m"||i==="min"||i==="minute"||i==="minutes"?a=t*60:a=t}return a}function Go(n,a,e,t,i){let r=[],o=n.compareTime(e,t)<1?e:t;for(;n.sameDate(o,e)&&n.compareTime(o,t)<1&&n.isValid(o);)r.push({value:o,label:n.format(o,a.display.timeOptionLabel)}),o=n.addSeconds(o,i);return r}var Zo=new N("MAT_TIMEPICKER_SCROLL_STRATEGY",{providedIn:"root",factory:()=>{let n=s(j);return()=>Fe(n)}}),_n=(()=>{class n{_dir=s(se,{optional:!0});_viewContainerRef=s(ve);_injector=s(j);_defaultConfig=s(tr,{optional:!0});_dateAdapter=s(X,{optional:!0});_dateFormats=s(Ie,{optional:!0});_scrollStrategyFactory=s(Zo);_animationsDisabled=Se();_isOpen=E(!1);_activeDescendant=E(null);_input=E(null);_overlayRef=null;_portal=null;_optionsCacheKey=null;_localeChanges;_onOpenRender=null;_panelTemplate=tt.required("panelTemplate");_timeOptions=[];_options=En(si);_keyManager=new Wn(this._options,this._injector).withHomeAndEnd(!0).withPageUpDown(!0).withVerticalOrientation(!0);interval=K(er(this._defaultConfig?.interval||null),{transform:er});options=K(null);isOpen=this._isOpen.asReadonly();selected=Kt();opened=Kt();closed=Kt();activeDescendant=this._activeDescendant.asReadonly();panelId=s(ce).getId("mat-timepicker-panel-");disableRipple=K(this._defaultConfig?.disableRipple??!1,{transform:F});ariaLabel=K(null,{alias:"aria-label"});ariaLabelledby=K(null,{alias:"aria-labelledby"});disabled=xe(()=>!!this._input()?.disabled());panelClass=K();constructor(){s(O).nativeElement.setAttribute("mat-timepicker-panel-id",this.panelId),this._handleLocaleChanges(),this._handleInputStateChanges(),this._keyManager.change.subscribe(()=>this._activeDescendant.set(this._keyManager.activeItem?.id||null))}open(){let e=this._input();if(!e||(e.focus(),this._isOpen()))return;this._isOpen.set(!0),this._generateOptions();let t=this._getOverlayRef();t.updateSize({width:e.getOverlayOrigin().nativeElement.offsetWidth}),this._portal??=new Xe(this._panelTemplate(),this._viewContainerRef),t.hasAttached()||t.attach(this._portal),this._onOpenRender?.destroy(),this._onOpenRender=fe(()=>{let i=this._options();this._syncSelectedState(e.value(),i,i[0]),this._onOpenRender=null},{injector:this._injector}),this.opened.emit()}close(){this._isOpen()&&(this._isOpen.set(!1),this.closed.emit(),this._animationsDisabled&&this._overlayRef?.detach())}registerInput(e){let t=this._input();this._input.set(e)}ngOnDestroy(){this._keyManager.destroy(),this._localeChanges?.unsubscribe(),this._onOpenRender?.destroy(),this._overlayRef?.dispose()}_getOverlayHost(){return this._overlayRef?.hostElement}_selectValue(e){this.close(),this._keyManager.setActiveItem(e),this._options().forEach(t=>{t!==e&&t.deselect(!1)}),this._input()?.timepickerValueAssigned(e.value),this.selected.emit({value:e.value,source:this}),this._input()?.focus()}_getAriaLabelledby(){return this.ariaLabel()?null:this.ariaLabelledby()||this._input()?.getLabelId()||null}_handleAnimationEnd(e){e.animationName==="_mat-timepicker-exit"&&this._overlayRef?.detach()}_getOverlayRef(){if(this._overlayRef)return this._overlayRef;let e=Le(this._injector,this._input().getOverlayOrigin()).withFlexibleDimensions(!1).withPush(!1).withTransformOriginOn(".mat-timepicker-panel").withPopoverLocation("inline").withPositions([{originX:"start",originY:"bottom",overlayX:"start",overlayY:"top"},{originX:"start",originY:"top",overlayX:"start",overlayY:"bottom",panelClass:"mat-timepicker-above"}]);return this._overlayRef=Ne(this._injector,{positionStrategy:e,scrollStrategy:this._scrollStrategyFactory(),direction:this._dir||"ltr",hasBackdrop:!1,disableAnimations:this._animationsDisabled,panelClass:this.panelClass()}),this._overlayRef.detachments().subscribe(()=>this.close()),this._overlayRef.keydownEvents().subscribe(t=>this._handleKeydown(t)),this._overlayRef.outsidePointerEvents().subscribe(t=>{let i=it(t),r=this._input()?.getOverlayOrigin().nativeElement;i&&r&&i!==r&&!r.contains(i)&&this.close()}),this._overlayRef}_generateOptions(){let e=this.interval()??1800,t=this.options();if(t!==null)this._timeOptions=t;else{let i=this._input(),r=this._dateAdapter,o=this._dateFormats.display.timeInput,p=i?.min()||r.setTime(r.today(),0,0,0),f=i?.max()||r.setTime(r.today(),23,59,0),y=e+"/"+r.format(p,o)+"/"+r.format(f,o);y!==this._optionsCacheKey&&(this._optionsCacheKey=y,this._timeOptions=Go(r,this._dateFormats,p,f,e))}}_syncSelectedState(e,t,i){let r=!1;for(let o of t)e&&this._dateAdapter.sameTime(o.value,e)?(o.select(!1),hn(o,"center"),Mt(()=>this._keyManager.setActiveItem(o)),r=!0):o.deselect(!1);r||(i?(Mt(()=>this._keyManager.setActiveItem(i)),hn(i,"center")):Mt(()=>this._keyManager.setActiveItem(-1)))}_handleKeydown(e){let t=e.keyCode;if(t===9)this.close();else if(t===27&&!de(e))e.preventDefault(),this.close();else if(t===13)e.preventDefault(),this._keyManager.activeItem?this._selectValue(this._keyManager.activeItem):this.close();else{let i=this._keyManager.activeItem;this._keyManager.onKeydown(e);let r=this._keyManager.activeItem;r&&r!==i&&hn(r,"nearest")}}_handleLocaleChanges(){this._localeChanges=this._dateAdapter.localeChanges.subscribe(()=>{this._optionsCacheKey=null,this.isOpen()&&this._generateOptions()})}_handleInputStateChanges(){Ae(()=>{let e=this._input(),t=this._options();this._isOpen()&&e&&this._syncSelectedState(e.value(),t,null)})}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-timepicker"]],viewQuery:function(t,i){t&1&&Yt(i._panelTemplate,Yo,5)(i._options,si,5),t&2&&kt(2)},inputs:{interval:[1,"interval"],options:[1,"options"],disableRipple:[1,"disableRipple"],ariaLabel:[1,"aria-label","ariaLabel"],ariaLabelledby:[1,"aria-labelledby","ariaLabelledby"],panelClass:[1,"panelClass"]},outputs:{selected:"selected",opened:"opened",closed:"closed"},exportAs:["matTimepicker"],features:[q([{provide:Un,useExisting:n}])],decls:2,vars:0,consts:[["panelTemplate",""],["role","listbox",1,"mat-timepicker-panel",3,"animationend","id"],[3,"value"],[3,"onSelectionChange","value"]],template:function(t,i){t&1&&Pe(0,qo,3,7,"ng-template",null,0,Xt)},dependencies:[si],styles:[`@keyframes _mat-timepicker-enter {
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
`],encapsulation:2,changeDetection:0})}return n})();function hn(n,a){n._getHostElement().scrollIntoView({block:a,inline:a})}var ir=(()=>{class n{_elementRef=s(O);_dateAdapter=s(X,{optional:!0});_dateFormats=s(Ie,{optional:!0});_formField=s(We,{optional:!0});_onChange;_onTouched;_validatorOnChange;_cleanupClick;_accessorDisabled=E(!1);_localeSubscription;_timepickerSubscription;_validator;_lastValueValid=!0;_minValid=!0;_maxValid=!0;_lastValidDate=null;_ariaActiveDescendant=xe(()=>{let e=this.timepicker(),t=e.isOpen(),i=e.activeDescendant();return t&&i?i:null});_ariaExpanded=xe(()=>this.timepicker().isOpen()+"");_ariaControls=xe(()=>{let e=this.timepicker();return e.isOpen()?e.panelId:null});value=On(null);timepicker=K.required({alias:"matTimepicker"});min=K(null,{alias:"matTimepickerMin",transform:e=>this._transformDateInput(e)});max=K(null,{alias:"matTimepickerMax",transform:e=>this._transformDateInput(e)});openOnClick=K(!0,{alias:"matTimepickerOpenOnClick",transform:F});disabled=xe(()=>this.disabledInput()||this._accessorDisabled());disabledInput=K(!1,{transform:F,alias:"disabled"});constructor(){let e=s(ae);this._validator=this._getValidator(),this._updateFormsState(),this._registerTimepicker(),this._localeSubscription=this._dateAdapter.localeChanges.subscribe(()=>{this._hasFocus()||this._formatValue(this.value())}),this._cleanupClick=e.listen(this.getOverlayOrigin().nativeElement,"click",this._handleClick)}writeValue(e){let t=this._dateAdapter.deserialize(e);this.value.set(this._dateAdapter.getValidDateOrNull(t))}registerOnChange(e){this._onChange=e}registerOnTouched(e){this._onTouched=e}setDisabledState(e){this._accessorDisabled.set(e)}validate(e){return this._validator(e)}registerOnValidatorChange(e){this._validatorOnChange=e}getOverlayOrigin(){return this._formField?.getConnectedOverlayOrigin()||this._elementRef}focus(){this._elementRef.nativeElement.focus()}ngOnDestroy(){this._cleanupClick(),this._timepickerSubscription?.unsubscribe(),this._localeSubscription.unsubscribe()}getLabelId(){return this._formField?.getLabelId()||null}_handleClick=e=>{if(this.disabled()||!this.openOnClick())return;let t=it(e),i=this.timepicker()._getOverlayHost();(!t||!i||!i.contains(t))&&this.timepicker().open()};_handleInput(e){let t=e.target.value,i=this.value(),r=this._dateAdapter.parseTime(t,this._dateFormats.parse.timeInput),o=!this._dateAdapter.sameTime(r,i);!r||o||t&&!i?this._assignUserSelection(r,!0):this._validatorOnChange?.()}_handleBlur(){let e=this.value();e&&this._isValid(e)&&this._formatValue(e),this.timepicker().isOpen()||this._onTouched?.()}_handleKeydown(e){this.timepicker().isOpen()||this.disabled()||(e.keyCode===27&&!de(e)&&this.value()!==null?(e.preventDefault(),this.value.set(null),this._formatValue(null)):(e.keyCode===40||e.keyCode===38)&&(e.preventDefault(),this.timepicker().open()))}timepickerValueAssigned(e){this._dateAdapter.sameTime(e,this.value())||(this._assignUserSelection(e,!0),this._formatValue(e))}_updateFormsState(){Ae(()=>{let{_dateAdapter:e,_lastValueValid:t,_minValid:i,_maxValid:r}=this,o=e.deserialize(this.value()),p=this.min(),f=this.max(),y=this._lastValueValid=this._isValid(o);this._minValid=!p||!o||!y||e.compareTime(p,o)<=0,this._maxValid=!f||!o||!y||e.compareTime(f,o)>=0;let v=t!==y||i!==this._minValid||r!==this._maxValid;this._hasFocus()||this._formatValue(o),o&&y&&(this._lastValidDate=o),v&&this._validatorOnChange?.()})}_registerTimepicker(){Ae(()=>{let e=this.timepicker();e.registerInput(this),e.closed.subscribe(()=>this._onTouched?.())})}_assignUserSelection(e,t){let i;if(e==null||!this._isValid(e))i=e;else{let r=this._dateAdapter,o=r.getValidDateOrNull(this._lastValidDate||this.value()),p=r.getHours(e),f=r.getMinutes(e),y=r.getSeconds(e);i=o?r.setTime(o,p,f,y):e}t&&this._onChange?.(i),this.value.set(i)}_formatValue(e){e=this._dateAdapter.getValidDateOrNull(e),this._elementRef.nativeElement.value=e==null?"":this._dateAdapter.format(e,this._dateFormats.display.timeInput)}_isValid(e){return!e||this._dateAdapter.isValid(e)}_transformDateInput(e){let t=typeof e=="string"?this._dateAdapter.parseTime(e,this._dateFormats.parse.timeInput):this._dateAdapter.deserialize(e);return t&&this._dateAdapter.isValid(t)?t:null}_hasFocus(){return St()===this._elementRef.nativeElement}_getValidator(){return Re.compose([()=>this._lastValueValid?null:{matTimepickerParse:{text:this._elementRef.nativeElement.value}},e=>this._minValid?null:{matTimepickerMin:{min:this.min(),actual:this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value))}},e=>this._maxValid?null:{matTimepickerMax:{max:this.max(),actual:this._dateAdapter.getValidDateOrNull(this._dateAdapter.deserialize(e.value))}}])}static \u0275fac=function(t){return new(t||n)};static \u0275dir=T({type:n,selectors:[["input","matTimepicker",""]],hostAttrs:["role","combobox","type","text","aria-haspopup","listbox",1,"mat-timepicker-input"],hostVars:5,hostBindings:function(t,i){if(t&1&&_("blur",function(){return i._handleBlur()})("input",function(o){return i._handleInput(o)})("keydown",function(o){return i._handleKeydown(o)}),t&2){let r;oe("disabled",i.disabled()),w("aria-activedescendant",i._ariaActiveDescendant())("aria-expanded",i._ariaExpanded())("aria-controls",i._ariaControls())("mat-timepicker-id",(r=i.timepicker())==null?null:r.panelId)}},inputs:{value:[1,"value"],timepicker:[1,"matTimepicker","timepicker"],min:[1,"matTimepickerMin","min"],max:[1,"matTimepickerMax","max"],openOnClick:[1,"matTimepickerOpenOnClick","openOnClick"],disabledInput:[1,"disabled","disabledInput"]},outputs:{value:"valueChange"},exportAs:["matTimepickerInput"],features:[q([{provide:je,useExisting:n,multi:!0},{provide:ut,useExisting:n,multi:!0},{provide:ft,useExisting:n}])]})}return n})(),Qo=(()=>{class n{_defaultConfig=s(tr,{optional:!0});_defaultTabIndex=(()=>{let e=s(new $t("tabindex"),{optional:!0}),t=Number(e);return isNaN(t)?null:t})();_isDisabled=xe(()=>{let e=this.timepicker();return this.disabled()||e.disabled()});timepicker=K.required({alias:"for"});ariaLabel=K(void 0,{alias:"aria-label"});ariaLabelledby=K(void 0,{alias:"aria-labelledby"});_defaultAriaLabel="Open timepicker options";disabled=K(!1,{transform:F,alias:"disabled"});tabIndex=K(this._defaultTabIndex);disableRipple=K(this._defaultConfig?.disableRipple??!1,{transform:F});_open(e){this.timepicker()&&!this._isDisabled()&&(this.timepicker().open(),e.stopPropagation())}getAriaLabel(){return this.ariaLabelledby()?null:this.ariaLabel()||this._defaultAriaLabel}static \u0275fac=function(t){return new(t||n)};static \u0275cmp=P({type:n,selectors:[["mat-timepicker-toggle"]],hostAttrs:[1,"mat-timepicker-toggle"],hostVars:1,hostBindings:function(t,i){t&1&&_("click",function(o){return i._open(o)}),t&2&&w("tabindex",null)},inputs:{timepicker:[1,"for","timepicker"],ariaLabel:[1,"aria-label","ariaLabel"],ariaLabelledby:[1,"aria-labelledby","ariaLabelledby"],disabled:[1,"disabled"],tabIndex:[1,"tabIndex"],disableRipple:[1,"disableRipple"]},exportAs:["matTimepickerToggle"],ngContentSelectors:$o,decls:3,vars:6,consts:[["matIconButton","","type","button","aria-haspopup","listbox",3,"tabIndex","disabled","disableRipple"],["height","24px","width","24px","viewBox","0 -960 960 960","fill","currentColor","focusable","false","aria-hidden","true",1,"mat-timepicker-toggle-default-icon"],["d","m612-292 56-56-148-148v-184h-80v216l172 172ZM480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm0 320q133 0 226.5-93.5T800-480q0-133-93.5-226.5T480-800q-133 0-226.5 93.5T160-480q0 133 93.5 226.5T480-160Z"]],template:function(t,i){t&1&&(ge(Xo),c(0,"button",0),H(1,0,null,Ko,2,0),u()),t&2&&(g("tabIndex",i._isDisabled()?-1:i.tabIndex())("disabled",i._isDisabled())("disableRipple",i.disableRipple()),w("aria-label",i.getAriaLabel())("aria-labelledby",i.ariaLabelledby())("aria-expanded",i.timepicker().isOpen()))},dependencies:[Ot],encapsulation:2,changeDetection:0})}return n})(),nr=(()=>{class n{static \u0275fac=function(t){return new(t||n)};static \u0275mod=G({type:n});static \u0275inj=U({imports:[_n,Qo,nt]})}return n})();function as(n,a){n&1&&(c(0,"strong"),b(1,"*"),u())}function rs(n,a){if(n&1&&(c(0,"span",13),b(1),C(2,as,2,0,"strong"),u()),n&2){let e=d(2);l(),M(e.label),l(),x(e.required?2:-1)}}function os(n,a){if(n&1){let e=R();c(0,"div",8)(1,"label",12),C(2,rs,3,2,"span",13),c(3,"div",14)(4,"mat-form-field",15)(5,"input",16),_("ngModelChange",function(i){m(e);let r=d();return h(r.onTimeOnlyChange(i))})("blur",function(){m(e);let i=d();return h(i.markTouched())}),u(),c(6,"button",17),_("mousedown",function(i){return i.preventDefault()})("click",function(i){m(e);let r=W(10),o=d();return h(o.toggleTimePicker(r,"time",i))}),c(7,"mat-icon"),b(8),u()(),c(9,"mat-timepicker",18,0),_("opened",function(){m(e);let i=d();return h(i.setPickerOpen("time",!0))})("closed",function(){m(e);let i=d();return h(i.setPickerOpen("time",!1))}),u()()()()()}if(n&2){let e=W(10),t=d();l(2),x(t.label?2:-1),l(3),g("matTimepicker",e)("matTimepickerOpenOnClick",!0)("ngModel",t.singleTimeValue)("disabled",t.inputDisabled()),l(),k("date-input__toggle--open",t.isPickerOpen("time")),g("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("time")),l(2),M(t.pickerIcon("time","schedule"))}}function ss(n,a){if(n&1){let e=R();c(0,"div",9)(1,"label",12)(2,"div",14)(3,"mat-form-field",19)(4,"mat-date-range-input",20)(5,"input",21),_("ngModelChange",function(i){m(e);let r=d();return h(r.onStartDateChange(i))})("blur",function(){m(e);let i=d();return h(i.markTouched())}),u(),c(6,"input",22),_("ngModelChange",function(i){m(e);let r=d();return h(r.onEndDateChange(i))})("blur",function(){m(e);let i=d();return h(i.markTouched())}),u()(),c(7,"button",23),_("mousedown",function(i){return i.preventDefault()})("click",function(i){m(e);let r=W(11),o=d();return h(o.toggleDateRangePicker(r,"range-date",i))}),c(8,"mat-icon"),b(9),u()(),c(10,"mat-date-range-picker",18,1),_("opened",function(){m(e);let i=d();return h(i.setPickerOpen("range-date",!0))})("closed",function(){m(e);let i=d();return h(i.setPickerOpen("range-date",!1))}),u()()()()()}if(n&2){let e=W(11),t=d();l(4),g("rangePicker",e),l(),g("ngModel",t.startDateValue)("min",t.resolvedStartMin())("max",t.resolvedStartMax())("disabled",t.inputDisabled())("placeholder",t.startPlaceholder),w("aria-label",t.startLabel),l(),g("ngModel",t.endDateValue)("min",t.resolvedEndMin())("max",t.resolvedEndMax())("disabled",t.inputDisabled())("placeholder",t.endPlaceholder),w("aria-label",t.endLabel),l(),k("date-input__toggle--open",t.isPickerOpen("range-date")),g("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("range-date")),l(2),M(t.pickerIcon("range-date","calendar_month"))}}function ls(n,a){n&1&&(c(0,"strong"),b(1,"*"),u())}function ds(n,a){if(n&1){let e=R();c(0,"mat-form-field",15)(1,"input",16),_("ngModelChange",function(i){m(e);let r=d(2);return h(r.onStartTimeChange(i))})("blur",function(){m(e);let i=d(2);return h(i.markTouched())}),u(),c(2,"button",29),_("mousedown",function(i){return i.preventDefault()})("click",function(i){m(e);let r=W(6),o=d(2);return h(o.toggleTimePicker(r,"start-time",i))}),c(3,"mat-icon"),b(4),u()(),c(5,"mat-timepicker",18,4),_("opened",function(){m(e);let i=d(2);return h(i.setPickerOpen("start-time",!0))})("closed",function(){m(e);let i=d(2);return h(i.setPickerOpen("start-time",!1))}),u()()}if(n&2){let e=W(6),t=d(2);l(),g("matTimepicker",e)("matTimepickerOpenOnClick",!0)("ngModel",t.startTimeValue)("disabled",t.inputDisabled()),l(),k("date-input__toggle--open",t.isPickerOpen("start-time")),g("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("start-time")),l(2),M(t.pickerIcon("start-time","schedule"))}}function cs(n,a){n&1&&(c(0,"strong"),b(1,"*"),u())}function ps(n,a){if(n&1){let e=R();c(0,"mat-form-field",15)(1,"input",16),_("ngModelChange",function(i){m(e);let r=d(2);return h(r.onEndTimeChange(i))})("blur",function(){m(e);let i=d(2);return h(i.markTouched())}),u(),c(2,"button",30),_("mousedown",function(i){return i.preventDefault()})("click",function(i){m(e);let r=W(6),o=d(2);return h(o.toggleTimePicker(r,"end-time",i))}),c(3,"mat-icon"),b(4),u()(),c(5,"mat-timepicker",18,5),_("opened",function(){m(e);let i=d(2);return h(i.setPickerOpen("end-time",!0))})("closed",function(){m(e);let i=d(2);return h(i.setPickerOpen("end-time",!1))}),u()()}if(n&2){let e=W(6),t=d(2);l(),g("matTimepicker",e)("matTimepickerOpenOnClick",!0)("ngModel",t.endTimeValue)("disabled",t.inputDisabled()),l(),k("date-input__toggle--open",t.isPickerOpen("end-time")),g("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("end-time")),l(2),M(t.pickerIcon("end-time","schedule"))}}function us(n,a){if(n&1){let e=R();c(0,"div",24)(1,"label",12)(2,"span",13),b(3),C(4,ls,2,0,"strong"),u(),c(5,"div",14)(6,"mat-form-field",25)(7,"input",26),_("ngModelChange",function(i){m(e);let r=d();return h(r.onStartDateChange(i))})("blur",function(){m(e);let i=d();return h(i.markTouched())}),u(),c(8,"button",27),_("mousedown",function(i){return i.preventDefault()})("click",function(i){m(e);let r=W(12),o=d();return h(o.toggleDatePicker(r,"start-date",i))}),c(9,"mat-icon"),b(10),u()(),c(11,"mat-datepicker",18,2),_("opened",function(){m(e);let i=d();return h(i.setPickerOpen("start-date",!0))})("closed",function(){m(e);let i=d();return h(i.setPickerOpen("start-date",!1))}),u()(),C(13,ds,7,9,"mat-form-field",15),u()(),c(14,"label",12)(15,"span",13),b(16),C(17,cs,2,0,"strong"),u(),c(18,"div",14)(19,"mat-form-field",25)(20,"input",26),_("ngModelChange",function(i){m(e);let r=d();return h(r.onEndDateChange(i))})("blur",function(){m(e);let i=d();return h(i.markTouched())}),u(),c(21,"button",28),_("mousedown",function(i){return i.preventDefault()})("click",function(i){m(e);let r=W(25),o=d();return h(o.toggleDatePicker(r,"end-date",i))}),c(22,"mat-icon"),b(23),u()(),c(24,"mat-datepicker",18,3),_("opened",function(){m(e);let i=d();return h(i.setPickerOpen("end-date",!0))})("closed",function(){m(e);let i=d();return h(i.setPickerOpen("end-date",!1))}),u()(),C(26,ps,7,9,"mat-form-field",15),u()()()}if(n&2){let e=W(12),t=W(25),i=d();k("date-input--with-time",i.hasTime()),l(3),M(i.startLabel),l(),x(i.startRequired?4:-1),l(3),g("matDatepicker",e)("ngModel",i.startDateValue)("min",i.resolvedStartMin())("max",i.resolvedStartMax())("disabled",i.inputDisabled())("placeholder",i.startPlaceholder),l(),k("date-input__toggle--open",i.isPickerOpen("start-date")),g("disabled",i.inputDisabled()),w("aria-pressed",i.isPickerOpen("start-date")),l(2),M(i.pickerIcon("start-date","calendar_month")),l(3),x(i.hasTime()?13:-1),l(3),M(i.endLabel),l(),x(i.endRequired?17:-1),l(3),g("matDatepicker",t)("ngModel",i.endDateValue)("min",i.resolvedEndMin())("max",i.resolvedEndMax())("disabled",i.inputDisabled())("placeholder",i.endPlaceholder),l(),k("date-input__toggle--open",i.isPickerOpen("end-date")),g("disabled",i.inputDisabled()),w("aria-pressed",i.isPickerOpen("end-date")),l(2),M(i.pickerIcon("end-date","calendar_month")),l(3),x(i.hasTime()?26:-1)}}function ms(n,a){n&1&&(c(0,"strong"),b(1,"*"),u())}function hs(n,a){if(n&1&&(c(0,"span",13),b(1),C(2,ms,2,0,"strong"),u()),n&2){let e=d(2);l(),M(e.label),l(),x(e.required?2:-1)}}function _s(n,a){if(n&1){let e=R();c(0,"mat-form-field",15)(1,"input",16),_("ngModelChange",function(i){m(e);let r=d(2);return h(r.onSingleTimeChange(i))})("blur",function(){m(e);let i=d(2);return h(i.markTouched())}),u(),c(2,"button",17),_("mousedown",function(i){return i.preventDefault()})("click",function(i){m(e);let r=W(6),o=d(2);return h(o.toggleTimePicker(r,"single-time",i))}),c(3,"mat-icon"),b(4),u()(),c(5,"mat-timepicker",18,7),_("opened",function(){m(e);let i=d(2);return h(i.setPickerOpen("single-time",!0))})("closed",function(){m(e);let i=d(2);return h(i.setPickerOpen("single-time",!1))}),u()()}if(n&2){let e=W(6),t=d(2);l(),g("matTimepicker",e)("matTimepickerOpenOnClick",!0)("ngModel",t.singleTimeValue)("disabled",t.inputDisabled()),l(),k("date-input__toggle--open",t.isPickerOpen("single-time")),g("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("single-time")),l(2),M(t.pickerIcon("single-time","schedule"))}}function fs(n,a){if(n&1&&(c(0,"span",34),b(1),u()),n&2){let e=d(3);l(),M(e.metaLabel())}}function gs(n,a){if(n&1&&(c(0,"span",36),b(1),u()),n&2){let e=d(3);l(),M(e.metaIcon())}}function bs(n,a){if(n&1&&(c(0,"div",33),C(1,fs,2,1,"span",34),c(2,"span",35),C(3,gs,2,1,"span",36),c(4,"span"),b(5),u()()()),n&2){let e=d(2);l(),x(e.metaLabel()?1:-1),l(),g("ngClass","date-input__meta-badge--"+e.metaPalette()),l(),x(e.metaIcon()?3:-1),l(2),M(e.metaValue())}}function vs(n,a){if(n&1){let e=R();c(0,"div",31)(1,"label",12),C(2,hs,3,2,"span",13),c(3,"div",14)(4,"mat-form-field",25)(5,"input",26),_("ngModelChange",function(i){m(e);let r=d();return h(r.onSingleDateChange(i))})("blur",function(){m(e);let i=d();return h(i.markTouched())}),u(),c(6,"button",32),_("mousedown",function(i){return i.preventDefault()})("click",function(i){m(e);let r=W(10),o=d();return h(o.toggleDatePicker(r,"single-date",i))}),c(7,"mat-icon"),b(8),u()(),c(9,"mat-datepicker",18,6),_("opened",function(){m(e);let i=d();return h(i.setPickerOpen("single-date",!0))})("closed",function(){m(e);let i=d();return h(i.setPickerOpen("single-date",!1))}),u()(),C(11,_s,7,9,"mat-form-field",15),u()(),C(12,bs,6,4,"div",33),u()}if(n&2){let e=W(10),t=d();k("date-input--with-time",t.hasTime())("date-input--with-meta",t.hasMeta()),l(2),x(t.label?2:-1),l(3),g("matDatepicker",e)("ngModel",t.singleDateValue)("min",t.resolvedSingleMin())("max",t.resolvedSingleMax())("disabled",t.inputDisabled())("placeholder",t.placeholder),l(),k("date-input__toggle--open",t.isPickerOpen("single-date")),g("disabled",t.inputDisabled()),w("aria-pressed",t.isPickerOpen("single-date")),l(2),M(t.pickerIcon("single-date","calendar_month")),l(3),x(t.hasTime()?11:-1),l(),x(t.hasMeta()?12:-1)}}var Ei=class n{constructor(a){this.cdr=a}model=null;get compactRangeHost(){return this.isCompactRange()}static horoscopeMetaBySign={Aries:{label:"Kos",icon:"\u2648",palette:"aries"},Taurus:{label:"Bika",icon:"\u2649",palette:"taurus"},Gemini:{label:"Ikrek",icon:"\u264A",palette:"gemini"},Cancer:{label:"R\xE1k",icon:"\u264B",palette:"cancer"},Leo:{label:"Oroszl\xE1n",icon:"\u264C",palette:"leo"},Virgo:{label:"Sz\u0171z",icon:"\u264D",palette:"virgo"},Libra:{label:"M\xE9rleg",icon:"\u264E",palette:"libra"},Scorpio:{label:"Skorpi\xF3",icon:"\u264F",palette:"scorpio"},Sagittarius:{label:"Nyilas",icon:"\u2650",palette:"sagittarius"},Capricorn:{label:"Bak",icon:"\u2651",palette:"capricorn"},Aquarius:{label:"V\xEDz\xF6nt\u0151",icon:"\u2652",palette:"aquarius"},Pisces:{label:"Halak",icon:"\u2653",palette:"pisces"}};singleDateValue=null;singleTimeValue=null;startDateValue=null;startTimeValue=null;endDateValue=null;endTimeValue=null;openPickers=new Set;controlDisabled=!1;currentValue=null;onValueChange=()=>{};onTouched=()=>{};writeValue(a){this.currentValue=a??null,this.syncControlsFromValue(),this.cdr.markForCheck()}registerOnChange(a){this.onValueChange=a}registerOnTouched(a){this.onTouched=a}setDisabledState(a){this.controlDisabled=a,this.cdr.markForCheck()}isRange(){return this.mode==="range"}isCompactRange(){return this.isRange()&&this.rangeLayout==="compact"&&!this.hasTime()}isTimeOnly(){return this.mode==="time"}hasTime(){return this.precision==="minute"}inputDisabled(){return this.disabled||this.readOnly||this.controlDisabled}get label(){return`${this.singleField.label??""}`}get startLabel(){return`${this.startField.label??"Start"}`}get endLabel(){return`${this.endField.label??"End"}`}get placeholder(){return`${this.singleField.placeholder??"YYYY/MM/DD"}`}get startPlaceholder(){return`${this.startField.placeholder??"YYYY/MM/DD"}`}get endPlaceholder(){return`${this.endField.placeholder??"YYYY/MM/DD"}`}get required(){return this.singleField.required===!0}get startRequired(){return this.startField.required===!0}get endRequired(){return this.endField.required===!0}get mode(){return this.model?.mode??"single"}get precision(){return this.model?.precision??"date"}get valueFormat(){return this.model?.valueFormat??"iso-date-time"}get readOnly(){return this.model?.readOnly===!0}get disabled(){return this.model?.disabled===!0}get singleField(){return this.model?.field??{}}get range(){return this.model?.range??{}}get rangeLayout(){return this.range.layout??"split"}get startField(){return this.range.start??{}}get endField(){return this.range.end??{}}get bounds(){return this.range.bounds}get allowEndBeforeStart(){return this.range.allowEndBeforeStart===!0}get meta(){return this.model?.meta}resolvedSingleMin(){return this.toDatePickerBoundary(this.singleField.min)}resolvedSingleMax(){return this.toDatePickerBoundary(this.singleField.max)}resolvedStartMin(){return this.toDatePickerBoundary(this.bounds?.start??this.startField.min)}resolvedStartMax(){return this.toDatePickerBoundary(this.bounds?.end??this.startField.max)}resolvedEndMin(){return this.toDatePickerBoundary(this.allowEndBeforeStart?this.bounds?.start??this.endField.min:this.startDateValue??this.bounds?.start??this.endField.min)}resolvedEndMax(){return this.toDatePickerBoundary(this.bounds?.end??this.endField.max)}onSingleDateChange(a){this.singleDateValue=a,this.emitSingleValue()}onSingleTimeChange(a){this.singleTimeValue=a,this.emitSingleValue()}onTimeOnlyChange(a){this.singleTimeValue=a,this.emitTimeOnlyValue()}onStartDateChange(a){this.startDateValue=a,this.emitRangeValue()}onStartTimeChange(a){this.startTimeValue=a,this.emitRangeValue()}onEndDateChange(a){this.endDateValue=a,this.emitRangeValue()}onEndTimeChange(a){this.endTimeValue=a,this.emitRangeValue()}markTouched(){this.onTouched()}isPickerOpen(a){return this.openPickers.has(a)}pickerIcon(a,e){return this.isPickerOpen(a)?"close":e}hasMeta(){return this.meta!==null&&this.meta!==void 0}metaLabel(){return`${this.meta?.label??""}`.trim()}metaIcon(){return this.resolvedMetaValue()?.icon?.trim()||`${this.meta?.icon??""}`.trim()}metaValue(){return`${this.resolvedMetaValue()?.label??""}`.trim()||`${this.meta?.emptyLabel??""}`.trim()}metaPalette(){return this.resolvedMetaValue()?.palette?.trim()||`${this.meta?.palette??"blue"}`.trim()||"blue"}setPickerOpen(a,e){e?this.openPickers.add(a):this.openPickers.delete(a),this.cdr.markForCheck()}toggleDatePicker(a,e,t){if(t.preventDefault(),t.stopPropagation(),!this.inputDisabled()){if(a.opened||this.isPickerOpen(e)){a.close();return}a.open()}}toggleDateRangePicker(a,e,t){if(t.preventDefault(),t.stopPropagation(),!this.inputDisabled()){if(a.opened||this.isPickerOpen(e)){a.close();return}a.open()}}toggleTimePicker(a,e,t){if(t.preventDefault(),t.stopPropagation(),!this.inputDisabled()){if(this.isPickerOpen(e)){a.close();return}a.open()}}emitSingleValue(){if(this.inputDisabled())return;let a=this.datePartsToValue(this.singleDateValue,this.singleTimeValue);this.currentValue=a,this.onValueChange(a),this.onTouched()}emitTimeOnlyValue(){if(this.inputDisabled())return;let a=this.timeToValue(this.singleTimeValue);this.currentValue=a,this.onValueChange(a),this.onTouched()}emitRangeValue(){if(this.inputDisabled())return;let a={startAt:this.datePartsToValue(this.startDateValue,this.startTimeValue),endAt:this.datePartsToValue(this.endDateValue,this.endTimeValue),precision:this.precision},e=this.normalizedRange(a);this.currentValue=e,this.syncControlsFromValue(),this.onValueChange(e),this.onTouched()}syncControlsFromValue(){if(this.mode==="time"){let e=typeof this.currentValue=="string"?this.toTimeDate(this.currentValue):null;this.singleDateValue=null,this.singleTimeValue=e;return}if(this.mode==="range"){let e=this.isRangeValue(this.currentValue)?this.currentValue:{startAt:"",endAt:"",precision:this.precision},t=this.toDate(e.startAt),i=this.toDate(e.endAt);this.startDateValue=t,this.startTimeValue=t,this.endDateValue=i,this.endTimeValue=i;return}let a=typeof this.currentValue=="string"?this.toDate(this.currentValue):null;this.singleDateValue=a,this.singleTimeValue=a}timeToValue(a){return a?`${a.getHours()}`.padStart(2,"0")+":"+`${a.getMinutes()}`.padStart(2,"0"):""}toTimeDate(a){if(a instanceof Date)return Number.isFinite(a.getTime())?new Date(a):null;let t=`${a??""}`.trim().match(/^(\d{1,2}):(\d{2})$/);if(!t)return null;let i=Number(t[1]),r=Number(t[2]);if(!Number.isInteger(i)||!Number.isInteger(r)||i<0||i>23||r<0||r>59)return null;let o=new Date;return o.setHours(i,r,0,0),o}datePartsToValue(a,e){if(!a)return"";let t=new Date(a);if(this.precision==="minute"){let i=e??a;return t.setHours(i.getHours(),i.getMinutes(),0,0),Te.toIsoDateTimeLocal(t)}return t.setHours(0,0,0,0),this.valueFormat==="iso-date"?Te.toIsoDate(t):Te.toIsoDateTimeLocal(t)}toDate(a){if(a instanceof Date)return Number.isFinite(a.getTime())?new Date(a):null;let e=`${a??""}`.trim();if(!e)return null;if(/^\d{4}-\d{2}-\d{2}$/.test(e)){let[t,i,r]=e.split("-").map(p=>Number.parseInt(p,10)),o=new Date(t,i-1,r,0,0,0,0);return Number.isFinite(o.getTime())?o:null}return Te.isoLocalDateTimeToDate(e)}toDatePickerBoundary(a){let e=this.toDate(a);return e?new Date(e.getFullYear(),e.getMonth(),e.getDate(),0,0,0,0):null}normalizedRange(a){let e=this.toDate(a.startAt),t=this.toDate(a.endAt),i=this.toDate(this.bounds?.start??this.startField.min),r=this.toDate(this.bounds?.end??this.endField.max);if(!e)return{startAt:"",endAt:"",precision:this.precision};let o=new Date(e);i&&o.getTime()<i.getTime()&&(o=new Date(i)),r&&o.getTime()>r.getTime()&&(o=new Date(r));let p=3600*1e3;return(!t||!this.allowEndBeforeStart&&t.getTime()<=o.getTime())&&(t=new Date(o.getTime()+p)),r&&t.getTime()>r.getTime()&&(t=new Date(r)),!this.allowEndBeforeStart&&t.getTime()<=o.getTime()&&(o=i&&r&&r.getTime()>i.getTime()?new Date(Math.max(i.getTime(),r.getTime()-p)):o,t=r&&r.getTime()>o.getTime()?new Date(r):new Date(o.getTime()+p)),{startAt:this.dateToValue(o),endAt:this.dateToValue(t),precision:this.precision}}dateToValue(a){if(this.precision==="minute")return Te.toIsoDateTimeLocal(a);let e=new Date(a);return e.setHours(0,0,0,0),this.valueFormat==="iso-date"?Te.toIsoDate(e):Te.toIsoDateTimeLocal(e)}isRangeValue(a){return!!a&&typeof a=="object"&&"startAt"in a&&"endAt"in a}resolvedMetaValue(){return this.meta?this.meta.kind==="horoscope"?this.horoscopeMetaValue():{label:this.meta.emptyLabel??"",icon:this.meta.icon??"",palette:this.meta.palette??"blue"}:null}horoscopeMetaValue(){let a=this.singleDateValue??(typeof this.currentValue=="string"?this.toDate(this.currentValue):null);if(!a)return null;let e=Te.horoscopeByDate(a);return n.horoscopeMetaBySign[e]??n.horoscopeMetaBySign.Pisces}static \u0275fac=function(e){return new(e||n)(Dn(Z))};static \u0275cmp=P({type:n,selectors:[["app-date-input"]],hostVars:2,hostBindings:function(e,t){e&2&&k("date-input-host--range-compact",t.compactRangeHost)},inputs:{model:"model"},features:[q([{provide:je,useExisting:dt(()=>n),multi:!0}])],decls:4,vars:1,consts:[["timeOnlyPicker",""],["rangePicker",""],["startPicker",""],["endPicker",""],["startTimePicker",""],["endTimePicker",""],["singlePicker",""],["singleTimePicker",""],[1,"date-input","date-input--time"],[1,"date-input","date-input--range-compact"],[1,"date-input","date-input--range",3,"date-input--with-time"],[1,"date-input","date-input--single",3,"date-input--with-time","date-input--with-meta"],[1,"date-input__field"],[1,"date-input__label"],[1,"date-input__row"],["appearance","outline","subscriptSizing","dynamic",1,"date-input__material","date-input__material--time"],["matInput","",3,"ngModelChange","blur","matTimepicker","matTimepickerOpenOnClick","ngModel","disabled"],["matSuffix","","type","button","aria-label","Toggle time picker",1,"date-input__toggle",3,"mousedown","click","disabled"],[3,"opened","closed"],["appearance","outline","subscriptSizing","dynamic",1,"date-input__material","date-input__material--range"],[3,"rangePicker"],["matStartDate","",3,"ngModelChange","blur","ngModel","min","max","disabled","placeholder"],["matEndDate","",3,"ngModelChange","blur","ngModel","min","max","disabled","placeholder"],["matSuffix","","type","button","aria-label","Toggle date range picker",1,"date-input__toggle",3,"mousedown","click","disabled"],[1,"date-input","date-input--range"],["appearance","outline","subscriptSizing","dynamic",1,"date-input__material","date-input__material--date"],["matInput","",3,"ngModelChange","blur","matDatepicker","ngModel","min","max","disabled","placeholder"],["matSuffix","","type","button","aria-label","Toggle start date picker",1,"date-input__toggle",3,"mousedown","click","disabled"],["matSuffix","","type","button","aria-label","Toggle end date picker",1,"date-input__toggle",3,"mousedown","click","disabled"],["matSuffix","","type","button","aria-label","Toggle start time picker",1,"date-input__toggle",3,"mousedown","click","disabled"],["matSuffix","","type","button","aria-label","Toggle end time picker",1,"date-input__toggle",3,"mousedown","click","disabled"],[1,"date-input","date-input--single"],["matSuffix","","type","button","aria-label","Toggle date picker",1,"date-input__toggle",3,"mousedown","click","disabled"],[1,"date-input__meta"],[1,"date-input__meta-label"],[1,"date-input__meta-badge",3,"ngClass"],[1,"date-input__meta-icon"]],template:function(e,t){e&1&&C(0,os,11,10,"div",8)(1,ss,12,18,"div",9)(2,us,27,30,"div",10)(3,vs,13,18,"div",11),e&2&&x(t.isTimeOnly()?0:t.isCompactRange()?1:t.isRange()?2:3)},dependencies:[Gt,Ut,ii,Vn,Qt,ei,Ua,Ya,Si,mn,Xa,$a,Ka,Ft,ci,qi,ri,ai,Ja,Qa,Gn,nr,_n,ir],styles:['[_nghost-%COMP%]{display:block;grid-column:1/-1;width:100%;min-width:0}.date-input-host--range-compact[_nghost-%COMP%]{--date-input-compact-control-width: 236px;--date-input-compact-shell-height: 34px;--date-input-compact-chip-height: 26px;--date-input-compact-chip-width: 10ch;grid-column:auto;width:var(--date-input-compact-control-width);min-width:var(--date-input-compact-control-width);max-width:var(--date-input-compact-control-width);flex:0 0 var(--date-input-compact-control-width);overflow:visible}.date-input[_ngcontent-%COMP%]{display:grid;gap:.62rem;width:100%}.date-input--range[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:start;gap:.72rem}.date-input--range-compact[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr);gap:0}.date-input--range-compact[_ngcontent-%COMP%]   .date-input__field[_ngcontent-%COMP%], .date-input--range-compact[_ngcontent-%COMP%]   .date-input__row[_ngcontent-%COMP%]{gap:0}.date-input--single.date-input--with-meta[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) minmax(120px,1fr);align-items:end}.date-input--time[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr)}.date-input__field[_ngcontent-%COMP%]{display:grid;gap:.34rem;min-width:0}.date-input__label[_ngcontent-%COMP%]{display:inline-flex;align-items:center;gap:.18rem;color:#203a5d;font-weight:700;font-size:.84rem;line-height:1.2}.date-input__label[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%]{color:#cf283f;font-weight:800}.date-input__row[_ngcontent-%COMP%]{display:grid;grid-template-columns:minmax(0,1fr);align-items:center;gap:.5rem;min-width:0}.date-input--with-time[_ngcontent-%COMP%]   .date-input__row[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) minmax(132px,148px)}.date-input__material[_ngcontent-%COMP%]{width:100%;min-width:0}[_nghost-%COMP%]     .date-input__material .mat-mdc-text-field-wrapper{min-height:38px;height:38px;padding:0 .48rem 0 .72rem;border:1px solid rgba(112,143,184,.56);border-radius:10px;background:#fff!important;box-shadow:none}[_nghost-%COMP%]     .date-input__material .mat-mdc-text-field-wrapper.mdc-text-field{background-color:#fff!important}[_nghost-%COMP%]     .date-input__material.mat-focused .mat-mdc-text-field-wrapper{border-color:#3872bed1;box-shadow:0 0 0 3px #3872be1a}[_nghost-%COMP%]     .date-input__material .mdc-text-field, [_nghost-%COMP%]     .date-input__material .mdc-text-field--filled{background:transparent}[_nghost-%COMP%]     .date-input__material .mdc-notched-outline__leading, [_nghost-%COMP%]     .date-input__material .mdc-notched-outline__notch, [_nghost-%COMP%]     .date-input__material .mdc-notched-outline__trailing{border:0}[_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-flex{min-height:36px;align-items:center}[_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-infix{width:auto;min-height:0;padding:0}[_nghost-%COMP%]     .date-input__material .mat-mdc-input-element{color:#183358;font-size:.92rem;line-height:1.2;min-width:0}[_nghost-%COMP%]     .date-input__material .mat-mdc-input-element:focus, [_nghost-%COMP%]     .date-input__material .mat-mdc-input-element:focus-visible{outline:none;box-shadow:none}[_nghost-%COMP%]     .date-input__material .mat-mdc-input-element::placeholder{color:#2d446185}[_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-subscript-wrapper, [_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-bottom-align, [_nghost-%COMP%]     .date-input__material .mdc-line-ripple, [_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-line-ripple, [_nghost-%COMP%]     .date-input__material .mdc-line-ripple--deactivating, [_nghost-%COMP%]     .date-input__material .mdc-line-ripple--active{display:none}[_nghost-%COMP%]     .date-input__material .mat-mdc-form-field-icon-suffix{align-self:stretch;display:inline-flex;align-items:center;padding:0}[_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-container{display:grid;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr);min-height:36px;height:36px;align-items:center;color:#183358}[_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-wrapper, [_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-start-wrapper, [_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-end-wrapper{display:flex;align-items:center;min-width:0;min-height:36px;height:36px;overflow:hidden}[_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-inner{color:#183358;font-size:.92rem;box-sizing:border-box;width:100%;height:100%;margin:0;padding:0;line-height:normal;min-width:0}[_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-inner::placeholder{color:#2d446185}[_nghost-%COMP%]     .date-input__material--range .mat-date-range-input-separator{margin:0 .22rem;color:#2d44619e}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-text-field-wrapper{min-height:var(--date-input-compact-shell-height);height:var(--date-input-compact-shell-height);padding:0 .22rem 0 .46rem;border-color:#2a538d42;border-radius:999px;background:#f7fbff!important;overflow:visible}[_nghost-%COMP%]     .date-input--range-compact .date-input__material.mat-focused .mat-mdc-text-field-wrapper{border-color:#3872bebd;box-shadow:0 0 0 3px #3872be1a}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-flex, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-infix, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-start-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-end-wrapper{min-width:0;min-height:var(--date-input-compact-shell-height);height:var(--date-input-compact-shell-height);overflow:hidden;border-bottom:0!important;box-shadow:none!important}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-flex, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-start-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-end-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-date-range-input-mirror{display:flex;align-items:center}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-infix{width:auto!important;flex:1 1 auto;padding-top:0!important;padding-bottom:0!important}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-focus-overlay{background:transparent!important;opacity:0!important}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-icon-suffix{align-self:stretch;flex:0 0 auto;min-width:0;display:inline-flex;align-items:center;justify-content:center;padding-right:.14rem}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-container{grid-template-columns:var(--date-input-compact-chip-width) 12px var(--date-input-compact-chip-width);column-gap:.12rem;width:100%;min-height:var(--date-input-compact-shell-height);height:var(--date-input-compact-shell-height);align-items:center;justify-content:center;overflow:hidden}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-start-wrapper, [_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-end-wrapper{flex:0 0 var(--date-input-compact-chip-width)!important;width:var(--date-input-compact-chip-width);max-width:var(--date-input-compact-chip-width);min-height:var(--date-input-compact-chip-height);height:var(--date-input-compact-chip-height);justify-content:center;border-radius:999px;background:#fff;box-shadow:inset 0 0 0 1px #2a538d29!important}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-end-wrapper{flex-grow:0!important}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-separator{min-height:var(--date-input-compact-shell-height);height:var(--date-input-compact-shell-height);margin:0;color:#5f7899;display:inline-flex;align-items:center;justify-content:center;line-height:var(--date-input-compact-shell-height)}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-inner, [_nghost-%COMP%]     .date-input--range-compact .date-input__material--range input, [_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-mirror{height:var(--date-input-compact-chip-height);min-height:var(--date-input-compact-chip-height);font-size:.76rem;font-weight:700;color:#2c4c74;line-height:var(--date-input-compact-chip-height);text-align:center;align-self:center}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-inner::placeholder{color:#2c4c747a}.date-input__toggle[_ngcontent-%COMP%]{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;min-width:28px;min-height:28px;padding:0;border:0;border-radius:999px;background:transparent;color:#315a86;cursor:pointer;transform-origin:center;transition:background-color .14s ease,color .14s ease,transform .14s ease,box-shadow .14s ease}.date-input__toggle[_ngcontent-%COMP%]:hover{background:#3b68a41a;color:#224a74}.date-input__toggle[_ngcontent-%COMP%]:active{transform:scale(.94)}.date-input__toggle--open[_ngcontent-%COMP%]{background:#315a8624;color:#1f4d7d;box-shadow:inset 0 0 0 1px #315a8624}.date-input__toggle--open[_ngcontent-%COMP%]:hover{background:#315a862e}.date-input--range-compact[_ngcontent-%COMP%]   .date-input__toggle[_ngcontent-%COMP%]{color:#365677;align-self:center}.date-input--range-compact[_ngcontent-%COMP%]   .date-input__toggle[_ngcontent-%COMP%]:hover{background:#3d68a71a;color:#24486e}.date-input__toggle[_ngcontent-%COMP%]:disabled{cursor:default;opacity:.58;transform:none;pointer-events:none}.date-input__toggle[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{width:18px;height:18px;font-size:18px;line-height:18px;transform-origin:center;transition:transform .18s cubic-bezier(.22,.61,.36,1),opacity .14s ease,filter .14s ease}.date-input__toggle--open[_ngcontent-%COMP%]   .mat-icon[_ngcontent-%COMP%]{transform:rotate(90deg)}.date-input__meta[_ngcontent-%COMP%]{display:grid;gap:.34rem;min-width:0}.date-input__meta-label[_ngcontent-%COMP%]{color:#203a5d;font-size:.84rem;font-weight:700;line-height:1.2}.date-input__meta-badge[_ngcontent-%COMP%]{min-height:38px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:8px;width:fit-content;max-width:100%;padding:0 14px;border:1px solid #b9cce5;border-radius:999px;background:#f3f8ff;color:#27568e;box-shadow:0 8px 18px #29548714;font-size:.88rem;font-weight:900;line-height:1.1;white-space:nowrap}.date-input__meta-icon[_ngcontent-%COMP%]{width:18px;height:18px;display:inline-flex;align-items:center;justify-content:center;font-family:"Noto Sans Symbols 2",Noto Sans Symbols,Segoe UI Symbol,sans-serif;font-size:18px;line-height:18px}.date-input__meta-badge--purple[_ngcontent-%COMP%]{border-color:#c8b7f2;background:#f5efff;color:#6941a6;box-shadow:0 8px 18px #6941a61a}.date-input__meta-badge--blue[_ngcontent-%COMP%]{border-color:#b9cce5;background:#f3f8ff;color:#27568e;box-shadow:0 8px 18px #29548714}.date-input__meta-badge--green[_ngcontent-%COMP%]{border-color:#a8dcb8;background:#f0fbf3;color:#2f7b47;box-shadow:0 8px 18px #2f7b471a}.date-input__meta-badge--violet[_ngcontent-%COMP%]{border-color:#c9b7e8;background:#f7f1ff;color:#65409b;box-shadow:0 8px 18px #65409b1a}.date-input__meta-badge--pink[_ngcontent-%COMP%]{border-color:#efb7d3;background:#fff0f7;color:#9a3f70;box-shadow:0 8px 18px #9a3f701a}.date-input__meta-badge--orange[_ngcontent-%COMP%]{border-color:#efc19d;background:#fff5ec;color:#93551e;box-shadow:0 8px 18px #93551e1a}.date-input__meta-badge--brown[_ngcontent-%COMP%]{border-color:#d7bd9c;background:#fbf4ec;color:#77502b;box-shadow:0 8px 18px #77502b1a}.date-input__meta-badge--teal[_ngcontent-%COMP%]{border-color:#a8d7d5;background:#effafa;color:#286f72;box-shadow:0 8px 18px #286f721a}.date-input__meta-badge--muted[_ngcontent-%COMP%]{border-color:#c7d0dc;background:#f5f7fa;color:#536274;box-shadow:0 8px 18px #53627414}.date-input__meta-badge--aries[_ngcontent-%COMP%]{border-color:#efb2a5;background:#fff1ed;color:#9b3f2c;box-shadow:0 8px 18px #9b3f2c1a}.date-input__meta-badge--taurus[_ngcontent-%COMP%]{border-color:#a7d69f;background:#f0faee;color:#3d7a31;box-shadow:0 8px 18px #3d7a311a}.date-input__meta-badge--gemini[_ngcontent-%COMP%]{border-color:#e6ce77;background:#fff9dc;color:#806219;box-shadow:0 8px 18px #8062191a}.date-input__meta-badge--cancer[_ngcontent-%COMP%]{border-color:#9fd8e6;background:#effbff;color:#237083;box-shadow:0 8px 18px #2370831a}.date-input__meta-badge--leo[_ngcontent-%COMP%]{border-color:#efc061;background:#fff5d9;color:#975d12;box-shadow:0 8px 18px #975d121a}.date-input__meta-badge--virgo[_ngcontent-%COMP%]{border-color:#bfd28d;background:#f8fbe9;color:#62752b;box-shadow:0 8px 18px #62752b1a}.date-input__meta-badge--libra[_ngcontent-%COMP%]{border-color:#efb7d3;background:#fff0f7;color:#9a3f70;box-shadow:0 8px 18px #9a3f701a}.date-input__meta-badge--scorpio[_ngcontent-%COMP%]{border-color:#c0a3d9;background:#f7effc;color:#663285;box-shadow:0 8px 18px #6632851a}.date-input__meta-badge--sagittarius[_ngcontent-%COMP%]{border-color:#b9a8ee;background:#f4f0ff;color:#553ca0;box-shadow:0 8px 18px #553ca01a}.date-input__meta-badge--capricorn[_ngcontent-%COMP%]{border-color:#cdb497;background:#fbf2e9;color:#705032;box-shadow:0 8px 18px #7050321a}.date-input__meta-badge--aquarius[_ngcontent-%COMP%]{border-color:#a8c8ef;background:#f0f7ff;color:#2c5f9f;box-shadow:0 8px 18px #2c5f9f1a}.date-input__meta-badge--pisces[_ngcontent-%COMP%]{border-color:#9cd5cf;background:#effaf8;color:#277268;box-shadow:0 8px 18px #2772681a}[_nghost-%COMP%]     .date-input__material.mat-mdc-form-field-disabled .mat-mdc-text-field-wrapper{background:linear-gradient(180deg,#f3f6fa,#e8edf5)!important;border-color:#7a8ca86b;box-shadow:none;cursor:not-allowed}[_nghost-%COMP%]     .date-input__material.mat-mdc-form-field-disabled .mat-mdc-input-element, [_nghost-%COMP%]     .date-input__material.mat-mdc-form-field-disabled .mat-icon{color:#3a4c67b3!important;-webkit-text-fill-color:rgba(58,76,103,.7)}@media(max-width:760px){.date-input--range[_ngcontent-%COMP%], .date-input--single.date-input--with-meta[_ngcontent-%COMP%]{grid-template-columns:1fr}.date-input--with-time[_ngcontent-%COMP%]   .date-input__row[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) minmax(108px,122px)}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-container{grid-template-columns:10ch 12px 10ch;column-gap:.08rem}[_nghost-%COMP%]     .date-input--range-compact .date-input__material--range .mat-date-range-input-inner, [_nghost-%COMP%]     .date-input--range-compact .date-input__material--range input{font-size:.74rem}[_nghost-%COMP%]     .date-input--range-compact .date-input__material .mat-mdc-form-field-icon-suffix{padding-right:.06rem}}@media(max-width:520px){.date-input--with-time[_ngcontent-%COMP%]   .date-input__row[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1fr) minmax(86px,104px);gap:.42rem}}'],changeDetection:0})};var ys=["*"],Cs=(n,a)=>[n,a],Dt=()=>[],Ai=(n,a)=>a.id;function xs(n,a){if(n&1&&(c(0,"h2"),b(1),He(2,"i18n"),u()),n&2){let e=d(2);l(),M(Ye(2,1,e.popupModel.title))}}function Ds(n,a){if(n&1&&(c(0,"p",7),b(1),He(2,"i18n"),u()),n&2){let e=d(2);l(),M(Ye(2,1,e.popupModel.subtitle))}}function ws(n,a){if(n&1&&(c(0,"p",8),b(1),He(2,"i18n"),u()),n&2){let e=d(2);l(),ze(" ",Ye(2,1,e.popupModel.secondarySubtitle)," ")}}function ks(n,a){if(n&1){let e=R();c(0,"app-menu",15),_("itemSelect",function(i){m(e);let r=d().$implicit,o=d(3);return h(o.selectMenuItem(r,i))}),u()}if(n&2){let e=d().$implicit;g("kind",e.menuKind??"select")("title",e.title??null)("trigger",e.trigger??null)("items",e.items??et(10,Dt))("groups",e.groups??et(11,Dt))("model",e.model??null)("panelAlign",e.panelAlign??"auto")("panelMode",e.panelMode??"auto")("mobileBreakpointPx",e.mobileBreakpointPx??760)("closeOnSelect",e.closeOnSelect??!0)}}function Ms(n,a){if(n&1){let e=R();c(0,"app-date-input",16),_("ngModelChange",function(i){m(e);let r=d().$implicit,o=d(3);return h(o.changeDateInput(r,i))}),u()}if(n&2){let e=d().$implicit;g("model",e.model)("ngModel",e.value)}}function Ss(n,a){if(n&1&&(c(0,"span"),b(1),He(2,"i18n"),u()),n&2){let e=d(2).$implicit;l(),M(Ye(2,1,e.label))}}function Es(n,a){if(n&1){let e=R();c(0,"button",17),_("click",function(i){m(e);let r=d().$implicit,o=d(3);return h(o.selectAction(r,i))}),c(1,"mat-icon"),b(2),u(),C(3,Ss,3,3,"span"),u()}if(n&2){let e=d().$implicit,t=d(3);k("ui-popup__action--active",e.active)("ui-popup__action--icon-only",!e.label)("ui-popup__action--compact-mobile",e.compactOnMobile),g("ngClass",t.actionPaletteClass(e))("disabled",e.disabled),w("aria-label",e.ariaLabel||e.label||e.id),l(2),M(e.icon),l(),x(e.label?3:-1)}}function As(n,a){if(n&1&&C(0,ks,1,12,"app-menu",13)(1,Ms,1,2,"app-date-input",14)(2,Es,4,11,"button",11),n&2){let e=a.$implicit,t=d(3);x(t.isMenuControl(e)?0:t.isDateInputControl(e)?1:2)}}function Os(n,a){if(n&1&&(c(0,"div",9),ye(1,As,3,1,null,null,Ai),u()),n&2){let e=d(2);l(),Ce(e.headerControls)}}function Ps(n,a){if(n&1&&(c(0,"span"),b(1),He(2,"i18n"),u()),n&2){let e=d().$implicit;l(),M(Ye(2,1,e.label))}}function Ts(n,a){if(n&1){let e=R();c(0,"button",17),_("click",function(i){let r=m(e).$implicit,o=d(2);return h(o.selectAction(r,i))}),c(1,"mat-icon"),b(2),u(),C(3,Ps,3,3,"span"),u()}if(n&2){let e=a.$implicit,t=d(2);k("ui-popup__action--active",e.active)("ui-popup__action--icon-only",!e.label)("ui-popup__action--compact-mobile",e.compactOnMobile),g("ngClass",t.actionPaletteClass(e))("disabled",e.disabled),w("aria-label",e.ariaLabel||e.label||e.id),l(2),M(e.icon),l(),x(e.label?3:-1)}}function Rs(n,a){if(n&1){let e=R();c(0,"button",18),_("click",function(i){m(e);let r=d(2);return h(r.emitClose(i))}),c(1,"mat-icon"),b(2,"close"),u()()}if(n&2){let e=d(2);w("aria-label",e.closeAriaLabel)}}function Is(n,a){if(n&1&&(c(0,"header",3)(1,"div",6),C(2,xs,3,3,"h2"),C(3,Ds,3,3,"p",7),C(4,ws,3,3,"p",8),u(),C(5,Os,3,0,"div",9),c(6,"div",10),ye(7,Ts,4,11,"button",11,Ai),C(9,Rs,3,1,"button",12),u()()),n&2){let e=d();g("ngClass",e.headerToneClass()),l(2),x(e.popupModel.title?2:-1),l(),x(e.popupModel.subtitle?3:-1),l(),x(e.popupModel.secondarySubtitle?4:-1),l(),x(e.hasHeaderControls?5:-1),l(),k("ui-popup__header-actions--empty",!e.hasHeaderActions&&!e.showClose),l(),Ce(e.headerActions),l(2),x(e.showClose?9:-1)}}function Vs(n,a){if(n&1){let e=R();c(0,"app-menu",15),_("itemSelect",function(i){m(e);let r=d().$implicit,o=d(3);return h(o.selectMenuItem(r,i))}),u()}if(n&2){let e=d().$implicit;g("kind",e.menuKind??"select")("title",e.title??null)("trigger",e.trigger??null)("items",e.items??et(10,Dt))("groups",e.groups??et(11,Dt))("model",e.model??null)("panelAlign",e.panelAlign??"auto")("panelMode",e.panelMode??"auto")("mobileBreakpointPx",e.mobileBreakpointPx??760)("closeOnSelect",e.closeOnSelect??!0)}}function Fs(n,a){if(n&1){let e=R();c(0,"app-date-input",16),_("ngModelChange",function(i){m(e);let r=d().$implicit,o=d(3);return h(o.changeDateInput(r,i))}),u()}if(n&2){let e=d().$implicit;g("model",e.model)("ngModel",e.value)}}function Ls(n,a){if(n&1&&(c(0,"span"),b(1),He(2,"i18n"),u()),n&2){let e=d(2).$implicit;l(),M(Ye(2,1,e.label))}}function Ns(n,a){if(n&1){let e=R();c(0,"button",17),_("click",function(i){m(e);let r=d().$implicit,o=d(3);return h(o.selectAction(r,i))}),c(1,"mat-icon"),b(2),u(),C(3,Ls,3,3,"span"),u()}if(n&2){let e=d().$implicit,t=d(3);k("ui-popup__action--active",e.active)("ui-popup__action--icon-only",!e.label)("ui-popup__action--compact-mobile",e.compactOnMobile),g("ngClass",t.actionPaletteClass(e))("disabled",e.disabled),w("aria-label",e.ariaLabel||e.label||e.id),l(2),M(e.icon),l(),x(e.label?3:-1)}}function Bs(n,a){if(n&1&&C(0,Vs,1,12,"app-menu",13)(1,Fs,1,2,"app-date-input",14)(2,Ns,4,11,"button",11),n&2){let e=a.$implicit,t=d(3);x(t.isMenuControl(e)?0:t.isDateInputControl(e)?1:2)}}function zs(n,a){if(n&1&&(c(0,"div",19),ye(1,Bs,3,1,null,null,Ai),u()),n&2){let e=d(2);l(),Ce(e.toolbarStartControls)}}function Hs(n,a){if(n&1){let e=R();c(0,"app-menu",15),_("itemSelect",function(i){m(e);let r=d().$implicit,o=d(3);return h(o.selectMenuItem(r,i))}),u()}if(n&2){let e=d().$implicit;g("kind",e.menuKind??"select")("title",e.title??null)("trigger",e.trigger??null)("items",e.items??et(10,Dt))("groups",e.groups??et(11,Dt))("model",e.model??null)("panelAlign",e.panelAlign??"auto")("panelMode",e.panelMode??"auto")("mobileBreakpointPx",e.mobileBreakpointPx??760)("closeOnSelect",e.closeOnSelect??!0)}}function Ys(n,a){if(n&1){let e=R();c(0,"app-date-input",16),_("ngModelChange",function(i){m(e);let r=d().$implicit,o=d(3);return h(o.changeDateInput(r,i))}),u()}if(n&2){let e=d().$implicit;g("model",e.model)("ngModel",e.value)}}function js(n,a){if(n&1&&(c(0,"span"),b(1),He(2,"i18n"),u()),n&2){let e=d(2).$implicit;l(),M(Ye(2,1,e.label))}}function Ws(n,a){if(n&1){let e=R();c(0,"button",17),_("click",function(i){m(e);let r=d().$implicit,o=d(3);return h(o.selectAction(r,i))}),c(1,"mat-icon"),b(2),u(),C(3,js,3,3,"span"),u()}if(n&2){let e=d().$implicit,t=d(3);k("ui-popup__action--active",e.active)("ui-popup__action--icon-only",!e.label)("ui-popup__action--compact-mobile",e.compactOnMobile),g("ngClass",t.actionPaletteClass(e))("disabled",e.disabled),w("aria-label",e.ariaLabel||e.label||e.id),l(2),M(e.icon),l(),x(e.label?3:-1)}}function qs(n,a){if(n&1&&C(0,Hs,1,12,"app-menu",13)(1,Ys,1,2,"app-date-input",14)(2,Ws,4,11,"button",11),n&2){let e=a.$implicit,t=d(3);x(t.isMenuControl(e)?0:t.isDateInputControl(e)?1:2)}}function Xs(n,a){if(n&1&&(c(0,"div",20),ye(1,qs,3,1,null,null,Ai),u()),n&2){let e=d(2);l(),Ce(e.toolbarEndControls)}}function $s(n,a){if(n&1&&(c(0,"div",4),C(1,zs,3,0,"div",19),C(2,Xs,3,0,"div",20),u()),n&2){let e=d();l(),x(e.hasToolbarStartControls?1:-1),l(),x(e.hasToolbarEndControls?2:-1)}}var ar=class n{model=null;zIndex=null;close=new D;menuSelect=new D;action=new D;dateInputChange=new D;get popupModel(){return this.model??{}}get ariaLabel(){return this.popupModel.ariaLabel?.trim()||this.popupModel.title?.trim()||"Popup"}get closeAriaLabel(){return this.popupModel.closeAriaLabel?.trim()||"Close"}get closeOnBackdrop(){return this.popupModel.closeOnBackdrop!==!1}get showClose(){return this.popupModel.showClose!==!1}get showHeader(){return this.popupModel.showHeader!==!1}get hasHeader(){return this.showHeader&&(!!this.popupModel.title?.trim()||!!this.popupModel.subtitle?.trim()||!!this.popupModel.secondarySubtitle?.trim()||this.hasHeaderControls||this.hasHeaderActions||this.showClose)}get headerControls(){return this.popupModel.headerControls??[]}get headerActions(){return this.popupModel.headerActions??[]}get toolbarControls(){return this.popupModel.toolbarControls??[]}get toolbarStartControls(){return this.toolbarControls.filter(a=>a.align!=="end")}get toolbarEndControls(){return this.toolbarControls.filter(a=>a.align==="end")}get hasToolbar(){return this.toolbarControls.length>0}get hasToolbarStartControls(){return this.toolbarStartControls.length>0}get hasToolbarEndControls(){return this.toolbarEndControls.length>0}get hasHeaderControls(){return this.headerControls.length>0}get hasHeaderActions(){return this.headerActions.length>0}onBackdropClick(a){this.closeOnBackdrop&&this.emitClose(a)}onPanelClick(a){a.stopPropagation()}isMenuControl(a){return"kind"in a&&a.kind==="menu"}isDateInputControl(a){return"kind"in a&&a.kind==="date-input"}actionPaletteClass(a){return`ui-popup__action--${a.palette??"default"}`}panelSizeClass(){return`ui-popup__panel--${this.popupModel.size??"default"}`}panelHeightClass(){return`ui-popup__panel--height-${this.popupModel.height??"auto"}`}headerToneClass(){return`ui-popup__header--${this.popupModel.headerTone??"default"}`}bodyLayoutClass(){return`ui-popup__body--${this.popupModel.bodyLayout??"default"}`}backdropToneClass(){return`ui-popup__backdrop--${this.popupModel.backdropTone??"default"}`}emitClose(a){this.popupModel.onClose?.(a),this.close.emit(a)}selectMenuItem(a,e){let t={control:a,itemSelect:e};this.popupModel.onMenuSelect?.(t),this.menuSelect.emit(t)}changeDateInput(a,e){let t={control:a,value:e};this.popupModel.onDateInputChange?.(t),this.dateInputChange.emit(t)}selectAction(a,e){if(a.disabled)return;let t={action:a,sourceEvent:e};this.popupModel.onAction?.(t),this.action.emit(t)}static \u0275fac=function(e){return new(e||n)};static \u0275cmp=P({type:n,selectors:[["app-popup"]],inputs:{model:"model",zIndex:"zIndex"},outputs:{close:"close",menuSelect:"menuSelect",action:"action",dateInputChange:"dateInputChange"},ngContentSelectors:ys,decls:7,vars:11,consts:[[1,"ui-popup"],[1,"ui-popup__backdrop",3,"click","ngClass"],["role","dialog","aria-modal","true",1,"ui-popup__panel",3,"click","ngClass"],[1,"ui-popup__header",3,"ngClass"],[1,"ui-popup__toolbar"],[1,"ui-popup__body",3,"ngClass"],[1,"ui-popup__title"],[1,"ui-popup__subtitle"],[1,"ui-popup__subtitle","ui-popup__subtitle--secondary"],[1,"ui-popup__header-controls"],[1,"ui-popup__header-actions"],["type","button",1,"ui-popup__action",3,"ngClass","ui-popup__action--active","ui-popup__action--icon-only","ui-popup__action--compact-mobile","disabled"],["type","button",1,"ui-popup__close"],[1,"ui-popup__control",3,"kind","title","trigger","items","groups","model","panelAlign","panelMode","mobileBreakpointPx","closeOnSelect"],[1,"ui-popup__date-input",3,"model","ngModel"],[1,"ui-popup__control",3,"itemSelect","kind","title","trigger","items","groups","model","panelAlign","panelMode","mobileBreakpointPx","closeOnSelect"],[1,"ui-popup__date-input",3,"ngModelChange","model","ngModel"],["type","button",1,"ui-popup__action",3,"click","ngClass","disabled"],["type","button",1,"ui-popup__close",3,"click"],[1,"ui-popup__toolbar-group","ui-popup__toolbar-group--start"],[1,"ui-popup__toolbar-group","ui-popup__toolbar-group--end"]],template:function(e,t){e&1&&(ge(),c(0,"div",0)(1,"div",1),_("click",function(r){return t.onBackdropClick(r)}),u(),c(2,"section",2),_("click",function(r){return t.onPanelClick(r)}),C(3,Is,10,8,"header",3),C(4,$s,3,2,"div",4),c(5,"div",5),H(6),u()()()),e&2&&(Je("z-index",t.zIndex??null),l(),g("ngClass",t.backdropToneClass()),l(),g("ngClass",Sn(8,Cs,t.panelSizeClass(),t.panelHeightClass())),w("aria-label",t.ariaLabel),l(),x(t.hasHeader?3:-1),l(),x(t.hasToolbar?4:-1),l(),g("ngClass",t.bodyLayoutClass()))},dependencies:[Gt,Ut,ii,Qt,ei,ri,ai,Nn,Ei,Ln],styles:[`app-popup{display:contents;--line: rgba(23, 33, 54, .12);--line-strong: rgba(23, 33, 54, .2);--text-main: #22324a;--text-muted: rgba(23, 41, 66, .72)}.ui-popup{position:fixed;inset:0;z-index:2300;display:flex;align-items:flex-start;justify-content:center;padding:1rem}.ui-popup__backdrop{position:absolute;inset:0;background:#e9edf5}.ui-popup__backdrop--dim{background:#08101e8f;-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}.ui-popup__panel{position:relative;z-index:1;width:min(760px,100vw - 1.2rem);max-height:calc(100vh - 1.2rem);max-height:calc(100dvh - 1.2rem);border-radius:14px;background:#fff;box-shadow:0 18px 42px #00000042;overflow:hidden;display:flex;flex-direction:column}.ui-popup__panel--wide{width:min(1080px,100vw - 1.2rem)}.ui-popup__panel--height-full{height:calc(100vh - 1.2rem);height:calc(100dvh - 1.2rem);max-height:calc(100vh - 1.2rem);max-height:calc(100dvh - 1.2rem)}.ui-popup__header{display:grid;grid-template-columns:minmax(0,1fr) auto auto;grid-template-areas:"title controls actions";align-items:center;gap:.42rem;padding:.58rem .4rem;border-bottom:1px solid var(--line);position:relative;flex:0 0 auto}.ui-popup__header--accent{border-bottom-color:#2e72b833}.ui-popup__title{grid-area:title;min-width:0}.ui-popup__title h2{margin:0;font-size:1.05rem;color:var(--text-main);font-weight:700;letter-spacing:0}.ui-popup__subtitle{margin:.14rem 0 0;font-size:.74rem;font-weight:700;color:#15273eb8}.ui-popup__subtitle--secondary{margin-top:.04rem;font-size:.68rem;font-weight:800;letter-spacing:.01em;color:#15273e94}.ui-popup__header-controls{grid-area:controls;min-width:0;display:inline-flex;align-items:center;justify-content:flex-end;gap:.34rem}.ui-popup__header-controls:empty{display:none}.ui-popup__header-actions{grid-area:actions;display:inline-flex;align-items:center;justify-content:flex-end;gap:.34rem}.ui-popup__header-actions--empty{display:none}.ui-popup__toolbar{flex:0 0 auto;padding:.4rem .4rem 0;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:.36rem .5rem}.ui-popup__toolbar-group{min-width:0;display:flex;align-items:center;gap:.5rem}.ui-popup__toolbar-group--start{grid-column:1;justify-content:flex-start;flex-wrap:wrap}.ui-popup__toolbar-group--end{grid-column:2;justify-content:flex-end;flex-wrap:nowrap;white-space:nowrap}.ui-popup__toolbar-group--end .ui-popup__action,.ui-popup__toolbar-group--end .ui-popup__control,.ui-popup__toolbar-group--end .ui-popup__date-input{flex:0 0 auto}.ui-popup__date-input{flex:0 0 auto;min-width:0}.ui-popup__body{padding:.4rem;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:.72rem;flex:1 1 auto;min-height:0}.ui-popup__body--fill{overflow:hidden}.ui-popup__action{min-width:2.25rem;min-height:2.25rem;height:2.25rem;border:1px solid rgba(30,88,152,.46);border-radius:999px;background:linear-gradient(180deg,#e2f0ff,#c5dbf8);color:#15457c;display:inline-flex;align-items:center;justify-content:center;gap:.34rem;cursor:pointer;box-shadow:0 2px 8px #1f4f842e;padding:0 .58rem;font:inherit;font-size:.78rem;font-weight:800;line-height:1;white-space:nowrap}.ui-popup__action--icon-only{width:2.25rem;padding:0;border-radius:50%}.ui-popup__action .mat-icon{width:1.14rem;height:1.14rem;font-size:1.14rem;line-height:1.14rem;pointer-events:none}.ui-popup__action:hover{background:linear-gradient(180deg,#d4e8ff,#b5d1f3);border-color:#1b4a8299;color:#103966;box-shadow:0 4px 10px #1c45723d}.ui-popup__action:active:not(:disabled){box-shadow:0 1px 4px #244a7933}.ui-popup__action:disabled{opacity:.54;cursor:not-allowed;box-shadow:0 2px 8px #1f4f841f}.ui-popup__action--gold,.ui-popup__action--amber{border-color:#bc8a1880;background:linear-gradient(180deg,#fff7df,#ffefc6);color:#8d5d10;box-shadow:0 5px 13px #b47f1733}.ui-popup__action--gold:hover,.ui-popup__action--amber:hover{border-color:#bc8a189e;background:linear-gradient(180deg,#fff2c9,#ffe3a3);color:#7d4f0a;box-shadow:0 4px 10px #b47f1738}.ui-popup__action--blue,.ui-popup__action--sky{border-color:#30558a57;background:linear-gradient(180deg,#f7fbff,#edf4ff);color:#2c5f9b}.ui-popup__action--green,.ui-popup__action--success{border-color:#2f8e5f61;background:linear-gradient(180deg,#effbf4,#dbf2e5);color:#23734a}.ui-popup__action--violet,.ui-popup__action--purple{border-color:#664fae80;background:linear-gradient(180deg,#f0ecff,#e3dbff);color:#5a43a9}.ui-popup__action--danger,.ui-popup__action--red{border-color:#931f1fa3;background:linear-gradient(180deg,#ffe8e8,#ffcfcf);color:#9a2626}.ui-popup__action--active{border-color:#1a447cad;background:linear-gradient(180deg,#d3e4ff,#bfd7ff);color:#123d73}.ui-popup__close{flex:0 0 auto;width:34px;height:34px;min-width:34px;min-height:34px;border:1px solid rgba(47,86,139,.2);border-radius:50%;background:#ffffffeb;color:#264369eb;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;padding:0;line-height:0;box-sizing:border-box;box-shadow:0 8px 18px #253e5f1f;--mdc-icon-button-state-layer-size: 34px}.ui-popup__close .mat-icon{display:inline-flex;align-items:center;justify-content:center;width:21px;height:21px;font-size:21px;line-height:21px;margin:0}.ui-popup__close:not(:disabled):not([aria-disabled=true]):hover{border-color:#2f568b52;background:#fff;color:#183254fa}.ui-popup__close:not(:disabled):not([aria-disabled=true]):active{background:#eff5fcf5}.ui-popup__close:focus-visible{outline:2px solid rgba(61,108,186,.35);outline-offset:1px}.ui-popup__close:disabled,.ui-popup__close[aria-disabled=true]{opacity:.56;cursor:default}@media(max-width:760px){.ui-popup{padding:0;align-items:stretch}.ui-popup__panel{width:100vw!important;max-width:100vw!important;height:100vh!important;height:100dvh!important;max-height:100vh!important;max-height:100dvh!important;min-height:100dvh;margin:0!important;border-radius:0;box-shadow:none}.ui-popup__header{align-items:start;gap:.36rem .44rem;padding:.52rem .48rem .44rem}.ui-popup__header-controls{width:auto;min-width:0;flex-wrap:nowrap}.ui-popup__header-controls app-menu{max-width:100%}.ui-popup__toolbar{padding:.36rem .48rem 0;display:flex;align-items:center;flex-wrap:nowrap;gap:.24rem;overflow:visible}.ui-popup__toolbar-group{gap:.24rem;flex-wrap:nowrap}.ui-popup__toolbar-group--start{flex:1 1 auto;min-width:0}.ui-popup__toolbar-group--start .ui-popup__control{flex:0 1 auto;min-width:0}.ui-popup__toolbar-group--end{flex:0 0 auto;gap:.24rem;margin-left:auto}.ui-popup__toolbar .app-menu__trigger{gap:.22rem;min-width:0;padding-inline:.42rem;font-size:.74rem}.ui-popup__toolbar .app-menu__trigger-label{text-overflow:clip}.ui-popup__toolbar .app-menu__trigger .mat-icon,.ui-popup__toolbar .app-menu__trigger-caret{width:1rem;height:1rem;font-size:1rem;line-height:1rem}.ui-popup__action--compact-mobile{width:2.25rem;padding:0;border-radius:50%}.ui-popup__action--compact-mobile span{display:none}}
`],encapsulation:2,changeDetection:0})};export{mt as a,ht as b,nt as c,Fe as d,Ji as e,Zi as f,zr as g,en as h,ji as i,Wi as j,qi as k,Pt as l,We as m,ci as n,Ya as o,Si as p,Oo as q,mn as r,Xa as s,$a as t,Ka as u,Ua as v,Ft as w,Qa as x,Ja as y,Ei as z,ar as A};
