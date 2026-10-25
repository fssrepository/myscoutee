import{cm as W,cU as et,E as c,co as D,ch as P,bG as Z,n as bt,T as E,aS as O,bk as M,au as vt,N as Mt,p as kt,l as j,B as X,bF as Q,a2 as xt,G as Tt,aF as y,$ as U,cG as yt,r as St,cl as h,bE as w,K as o,a3 as n,c3 as _,c0 as $,C as H,aa as it,q as Ct,bu as at,o as R,cM as N,bA as It,bS as st,c as wt,bU as m,M as rt,cr as Rt,cj as x,be as nt,bN as F,c9 as f,bz as p,by as G,g as S,ah as C,b_ as B,cw as K,a5 as v,bV as g,cN as lt,bt as q,ci as L,bm as Nt,P as Pt}from"./main-0d08a754.js";import{bQ as Et,O as Ot,t as ot,eA as At,ac as Vt,L as Dt,u as Ut,dL as Ft,W as Bt,en as Lt,bm as zt,dB as Wt,d2 as Xt,cv as $t,bi as Ht,aL as Y,ci as Gt,e0 as Kt,R as dt,ct as ht,bf as ct}from"./chunk-52421ac0.js";import{c as qt}from"./chunk-e6ee3c5c.js";import"./chunk-4f72e63a.js";import{am as Zt,aF as jt}from"./chunk-57a6019f.js";import{h as Qt,y as Yt}from"./chunk-478223ae.js";var Jt=["knob"],te=["valueIndicatorContainer"];function ee(s,a){if(s&1&&(h(0,"div",2,1)(2,"div",5)(3,"span",6),f(4),o()()()),s&2){let t=m();n(4),v(t.valueIndicatorText)}}var ie=["trackActive"],ae=["*"];function se(s,a){if(s&1&&w(0,"div"),s&2){let t=a.$implicit,e=a.$index,i=m(3);it(t===0?"mdc-slider__tick-mark--active":"mdc-slider__tick-mark--inactive"),Pt("transform",i._calcTickMarkTransform(e))}}function re(s,a){if(s&1&&B(0,se,1,4,"div",8,Nt),s&2){let t=m(2);L(t._tickMarks)}}function ne(s,a){if(s&1&&(h(0,"div",6,1),E(2,re,2,0),o()),s&2){let t=m();n(2),O(t._cachedWidth?2:-1)}}function le(s,a){if(s&1&&w(0,"mat-slider-visual-thumb",7),s&2){let t=m();_("discrete",t.discrete)("thumbPosition",1)("valueIndicatorText",t.startValueIndicatorText)}}var r=(function(s){return s[s.START=1]="START",s[s.END=2]="END",s})(r||{}),A=(function(s){return s[s.ACTIVE=0]="ACTIVE",s[s.INACTIVE=1]="INACTIVE",s})(A||{}),J=new H("_MatSlider"),ut=new H("_MatSliderThumb"),mt=new H("_MatSliderRangeThumb"),_t=new H("_MatSliderVisualThumb"),oe=(()=>{class s{_cdr=c(X);_ngZone=c(j);_slider=c(J);_renderer=c(rt);_listenerCleanups;discrete=!1;thumbPosition;valueIndicatorText;_ripple;_knob;_valueIndicatorContainer;_sliderInput;_sliderInputEl;_hoverRippleRef;_focusRippleRef;_activeRippleRef;_isHovered=!1;_isActive=!1;_isValueIndicatorVisible=!1;_hostElement=c(Q).nativeElement;_platform=c(Y);ngAfterViewInit(){let t=this._slider._getInput(this.thumbPosition);t&&(this._ripple.radius=24,this._sliderInput=t,this._sliderInputEl=this._sliderInput._hostElement,this._ngZone.runOutsideAngular(()=>{let e=this._sliderInputEl,i=this._renderer;this._listenerCleanups=[i.listen(e,"pointermove",this._onPointerMove),i.listen(e,"pointerdown",this._onDragStart),i.listen(e,"pointerup",this._onDragEnd),i.listen(e,"pointerleave",this._onMouseLeave),i.listen(e,"focus",this._onFocus),i.listen(e,"blur",this._onBlur)]}))}ngOnDestroy(){this._listenerCleanups?.forEach(t=>t())}_onPointerMove=t=>{if(this._sliderInput._isFocused)return;let e=this._hostElement.getBoundingClientRect(),i=this._slider._isCursorOnSliderThumb(t,e);this._isHovered=i,i?this._showHoverRipple():this._hideRipple(this._hoverRippleRef)};_onMouseLeave=()=>{this._isHovered=!1,this._hideRipple(this._hoverRippleRef)};_onFocus=()=>{this._hideRipple(this._hoverRippleRef),this._showFocusRipple(),this._hostElement.classList.add("mdc-slider__thumb--focused")};_onBlur=()=>{this._isActive||this._hideRipple(this._focusRippleRef),this._isHovered&&this._showHoverRipple(),this._hostElement.classList.remove("mdc-slider__thumb--focused")};_onDragStart=t=>{t.button===0&&(this._isActive=!0,this._showActiveRipple())};_onDragEnd=()=>{this._isActive=!1,this._hideRipple(this._activeRippleRef),this._sliderInput._isFocused||this._hideRipple(this._focusRippleRef),this._platform.SAFARI&&this._showHoverRipple()};_showHoverRipple(){this._isShowingRipple(this._hoverRippleRef)||(this._hoverRippleRef=this._showRipple({enterDuration:0,exitDuration:0}),this._hoverRippleRef?.element.classList.add("mat-mdc-slider-hover-ripple"))}_showFocusRipple(){this._isShowingRipple(this._focusRippleRef)||(this._focusRippleRef=this._showRipple({enterDuration:0,exitDuration:0},!0),this._focusRippleRef?.element.classList.add("mat-mdc-slider-focus-ripple"))}_showActiveRipple(){this._isShowingRipple(this._activeRippleRef)||(this._activeRippleRef=this._showRipple({enterDuration:225,exitDuration:400}),this._activeRippleRef?.element.classList.add("mat-mdc-slider-active-ripple"))}_isShowingRipple(t){return t?.state===ht.FADING_IN||t?.state===ht.VISIBLE}_showRipple(t,e){if(!this._slider.disabled&&(this._showValueIndicator(),this._slider._isRange&&this._slider._getThumb(this.thumbPosition===r.START?r.END:r.START)._showValueIndicator(),!(this._slider._globalRippleOptions?.disabled&&!e)))return this._ripple.launch({animation:this._slider._noopAnimations?{enterDuration:0,exitDuration:0}:t,centered:!0,persistent:!0})}_hideRipple(t){if(t?.fadeOut(),this._isShowingAnyRipple())return;this._slider._isRange||this._hideValueIndicator();let e=this._getSibling();e._isShowingAnyRipple()||(this._hideValueIndicator(),e._hideValueIndicator())}_showValueIndicator(){this._hostElement.classList.add("mdc-slider__thumb--with-indicator")}_hideValueIndicator(){this._hostElement.classList.remove("mdc-slider__thumb--with-indicator")}_getSibling(){return this._slider._getThumb(this.thumbPosition===r.START?r.END:r.START)}_getValueIndicatorContainer(){return this._valueIndicatorContainer?.nativeElement}_getKnob(){return this._knob.nativeElement}_isShowingAnyRipple(){return this._isShowingRipple(this._hoverRippleRef)||this._isShowingRipple(this._focusRippleRef)||this._isShowingRipple(this._activeRippleRef)}static \u0275fac=function(t){return new(t||s)};static \u0275cmp=Z({type:s,selectors:[["mat-slider-visual-thumb"]],viewQuery:function(t,e){if(t&1&&at(ct,5)(Jt,5)(te,5),t&2){let i;R(i=N())&&(e._ripple=i.first),R(i=N())&&(e._knob=i.first),R(i=N())&&(e._valueIndicatorContainer=i.first)}},hostAttrs:[1,"mdc-slider__thumb","mat-mdc-slider-visual-thumb"],inputs:{discrete:"discrete",thumbPosition:"thumbPosition",valueIndicatorText:"valueIndicatorText"},features:[$([{provide:_t,useExisting:s}])],decls:4,vars:2,consts:[["knob",""],["valueIndicatorContainer",""],[1,"mdc-slider__value-indicator-container"],[1,"mdc-slider__thumb-knob"],["matRipple","",1,"mat-focus-indicator",3,"matRippleDisabled"],[1,"mdc-slider__value-indicator"],[1,"mdc-slider__value-indicator-text"]],template:function(t,e){t&1&&(E(0,ee,5,1,"div",2),w(1,"div",3,0)(3,"div",4)),t&2&&(O(e.discrete?0:-1),n(3),_("matRippleDisabled",!0))},dependencies:[ct],styles:[`.mat-mdc-slider-visual-thumb .mat-ripple {
  height: 100%;
  width: 100%;
}

.mat-mdc-slider .mdc-slider__tick-marks {
  justify-content: start;
}
.mat-mdc-slider .mdc-slider__tick-marks .mdc-slider__tick-mark--active,
.mat-mdc-slider .mdc-slider__tick-marks .mdc-slider__tick-mark--inactive {
  position: absolute;
  left: 2px;
}
`],encapsulation:2})}return s})(),de=(()=>{class s{_ngZone=c(j);_cdr=c(X);_elementRef=c(Q);_dir=c(Xt,{optional:!0});_globalRippleOptions=c($t,{optional:!0});_trackActive;_thumbs;_input;_inputs;get disabled(){return this._disabled}set disabled(t){this._disabled=t;let e=this._getInput(r.END),i=this._getInput(r.START);e&&(e.disabled=this._disabled),i&&(i.disabled=this._disabled)}_disabled=!1;get discrete(){return this._discrete}set discrete(t){this._discrete=t,this._updateValueIndicatorUIs()}_discrete=!1;get showTickMarks(){return this._showTickMarks}set showTickMarks(t){this._showTickMarks=t,this._hasViewInitialized&&(this._updateTickMarkUI(),this._updateTickMarkTrackUI())}_showTickMarks=!1;get min(){return this._min}set min(t){let e=t==null||isNaN(t)?this._min:t;this._min!==e&&this._updateMin(e)}_min=0;color;disableRipple=!1;_updateMin(t){let e=this._min;this._min=t,this._isRange?this._updateMinRange({old:e,new:t}):this._updateMinNonRange(t),this._onMinMaxOrStepChange()}_updateMinRange(t){let e=this._getInput(r.END),i=this._getInput(r.START),d=e.value,u=i.value;i.min=t.new,e.min=Math.max(t.new,i.value),i.max=Math.min(e.max,e.value),i._updateWidthInactive(),e._updateWidthInactive(),t.new<t.old?this._onTranslateXChangeBySideEffect(e,i):this._onTranslateXChangeBySideEffect(i,e),d!==e.value&&this._onValueChange(e),u!==i.value&&this._onValueChange(i)}_updateMinNonRange(t){let e=this._getInput(r.END);if(e){let i=e.value;e.min=t,e._updateThumbUIByValue(),this._updateTrackUI(e),i!==e.value&&this._onValueChange(e)}}get max(){return this._max}set max(t){let e=t==null||isNaN(t)?this._max:t;this._max!==e&&this._updateMax(e)}_max=100;_updateMax(t){let e=this._max;this._max=t,this._isRange?this._updateMaxRange({old:e,new:t}):this._updateMaxNonRange(t),this._onMinMaxOrStepChange()}_updateMaxRange(t){let e=this._getInput(r.END),i=this._getInput(r.START),d=e.value,u=i.value;e.max=t.new,i.max=Math.min(t.new,e.value),e.min=i.value,e._updateWidthInactive(),i._updateWidthInactive(),t.new>t.old?this._onTranslateXChangeBySideEffect(i,e):this._onTranslateXChangeBySideEffect(e,i),d!==e.value&&this._onValueChange(e),u!==i.value&&this._onValueChange(i)}_updateMaxNonRange(t){let e=this._getInput(r.END);if(e){let i=e.value;e.max=t,e._updateThumbUIByValue(),this._updateTrackUI(e),i!==e.value&&this._onValueChange(e)}}get step(){return this._step}set step(t){let e=isNaN(t)?this._step:t;this._step!==e&&this._updateStep(e)}_step=1;_updateStep(t){this._step=t,this._isRange?this._updateStepRange():this._updateStepNonRange(),this._onMinMaxOrStepChange()}_updateStepRange(){let t=this._getInput(r.END),e=this._getInput(r.START),i=t.value,d=e.value,u=e.value;t.min=this._min,e.max=this._max,t.step=this._step,e.step=this._step,this._platform.SAFARI&&(t.value=t.value,e.value=e.value),t.min=Math.max(this._min,e.value),e.max=Math.min(this._max,t.value),e._updateWidthInactive(),t._updateWidthInactive(),t.value<u?this._onTranslateXChangeBySideEffect(e,t):this._onTranslateXChangeBySideEffect(t,e),i!==t.value&&this._onValueChange(t),d!==e.value&&this._onValueChange(e)}_updateStepNonRange(){let t=this._getInput(r.END);if(t){let e=t.value;t.step=this._step,this._platform.SAFARI&&(t.value=t.value),t._updateThumbUIByValue(),e!==t.value&&this._onValueChange(t)}}displayWith=t=>`${t}`;_tickMarks;_noopAnimations=Ht();_resizeObserver=null;_cachedWidth;_cachedLeft;_rippleRadius=24;startValueIndicatorText="";endValueIndicatorText="";_endThumbTransform;_startThumbTransform;_isRange=!1;_isRtl=xt(()=>this._dir?.valueSignal()==="rtl");_hasViewInitialized=!1;_tickMarkTrackWidth=0;_hasAnimation=!1;_resizeTimer=null;_platform=c(Y);constructor(){c(Gt).load(Kt);let t=this._isRtl();Tt(()=>{let e=this._isRtl();e!==t&&(t=e,this._isRange?this._onDirChangeRange():this._onDirChangeNonRange(),this._updateTickMarkUI())})}_knobRadius=8;_inputPadding;ngAfterViewInit(){this._platform.isBrowser&&this._updateDimensions();let t=this._getInput(r.END),e=this._getInput(r.START);this._isRange=!!t&&!!e,this._cdr.detectChanges();let i=this._getThumb(r.END);this._rippleRadius=i._ripple.radius,this._inputPadding=this._rippleRadius-this._knobRadius,this._isRange?this._initUIRange(t,e):this._initUINonRange(t),this._updateTrackUI(t),this._updateTickMarkUI(),this._updateTickMarkTrackUI(),this._observeHostResize(),this._cdr.detectChanges()}_initUINonRange(t){t.initProps(),t.initUI(),this._updateValueIndicatorUI(t),this._hasViewInitialized=!0,t._updateThumbUIByValue()}_initUIRange(t,e){t.initProps(),t.initUI(),e.initProps(),e.initUI(),t._updateMinMax(),e._updateMinMax(),t._updateStaticStyles(),e._updateStaticStyles(),this._updateValueIndicatorUIs(),this._hasViewInitialized=!0,t._updateThumbUIByValue(),e._updateThumbUIByValue()}ngOnDestroy(){this._resizeObserver?.disconnect(),this._resizeObserver=null}_onDirChangeRange(){let t=this._getInput(r.END),e=this._getInput(r.START);t._setIsLeftThumb(),e._setIsLeftThumb(),t.translateX=t._calcTranslateXByValue(),e.translateX=e._calcTranslateXByValue(),t._updateStaticStyles(),e._updateStaticStyles(),t._updateWidthInactive(),e._updateWidthInactive(),t._updateThumbUIByValue(),e._updateThumbUIByValue()}_onDirChangeNonRange(){this._getInput(r.END)._updateThumbUIByValue()}_observeHostResize(){typeof ResizeObserver>"u"||!ResizeObserver||this._ngZone.runOutsideAngular(()=>{this._resizeObserver=new ResizeObserver(()=>{this._isActive()||(this._resizeTimer&&clearTimeout(this._resizeTimer),this._onResize())}),this._resizeObserver.observe(this._elementRef.nativeElement)})}_isActive(){return this._getThumb(r.START)._isActive||this._getThumb(r.END)._isActive}_getValue(t=r.END){let e=this._getInput(t);return e?e.value:this.min}_skipUpdate(){return!!(this._getInput(r.START)?._skipUIUpdate||this._getInput(r.END)?._skipUIUpdate)}_updateDimensions(){this._cachedWidth=this._elementRef.nativeElement.offsetWidth,this._cachedLeft=this._elementRef.nativeElement.getBoundingClientRect().left}_setTrackActiveStyles(t){let e=this._trackActive.nativeElement.style;e.left=t.left,e.right=t.right,e.transformOrigin=t.transformOrigin,e.transform=t.transform}_calcTickMarkTransform(t){let e=t*(this._tickMarkTrackWidth/(this._tickMarks.length-1));return`translateX(${this._isRtl()?this._cachedWidth-6-e:e}px)`}_onTranslateXChange(t){this._hasViewInitialized&&(this._updateThumbUI(t),this._updateTrackUI(t),this._updateOverlappingThumbUI(t))}_onTranslateXChangeBySideEffect(t,e){this._hasViewInitialized&&(t._updateThumbUIByValue(),e._updateThumbUIByValue())}_onValueChange(t){this._hasViewInitialized&&(this._updateValueIndicatorUI(t),this._updateTickMarkUI(),this._cdr.detectChanges())}_onMinMaxOrStepChange(){this._hasViewInitialized&&(this._updateTickMarkUI(),this._updateTickMarkTrackUI(),this._cdr.markForCheck())}_onResize(){if(this._hasViewInitialized){if(this._updateDimensions(),this._isRange){let t=this._getInput(r.END),e=this._getInput(r.START);t._updateThumbUIByValue(),e._updateThumbUIByValue(),t._updateStaticStyles(),e._updateStaticStyles(),t._updateMinMax(),e._updateMinMax(),t._updateWidthInactive(),e._updateWidthInactive()}else{let t=this._getInput(r.END);t&&t._updateThumbUIByValue()}this._updateTickMarkUI(),this._updateTickMarkTrackUI(),this._cdr.detectChanges()}}_thumbsOverlap=!1;_areThumbsOverlapping(){let t=this._getInput(r.START),e=this._getInput(r.END);return!t||!e?!1:e.translateX-t.translateX<20}_updateOverlappingThumbClassNames(t){let e=t.getSibling(),i=this._getThumb(t.thumbPosition);this._getThumb(e.thumbPosition)._hostElement.classList.remove("mdc-slider__thumb--top"),i._hostElement.classList.toggle("mdc-slider__thumb--top",this._thumbsOverlap)}_updateOverlappingThumbUI(t){!this._isRange||this._skipUpdate()||this._thumbsOverlap!==this._areThumbsOverlapping()&&(this._thumbsOverlap=!this._thumbsOverlap,this._updateOverlappingThumbClassNames(t))}_updateThumbUI(t){if(this._skipUpdate())return;let e=this._getThumb(t.thumbPosition===r.END?r.END:r.START);e._hostElement.style.transform=`translateX(${t.translateX}px)`}_updateValueIndicatorUI(t){if(this._skipUpdate())return;let e=this.displayWith(t.value);if(this._hasViewInitialized?t._valuetext.set(e):t._hostElement.setAttribute("aria-valuetext",e),this.discrete){t.thumbPosition===r.START?this.startValueIndicatorText=e:this.endValueIndicatorText=e;let i=this._getThumb(t.thumbPosition);e.length<3?i._hostElement.classList.add("mdc-slider__thumb--short-value"):i._hostElement.classList.remove("mdc-slider__thumb--short-value")}}_updateValueIndicatorUIs(){let t=this._getInput(r.END),e=this._getInput(r.START);t&&this._updateValueIndicatorUI(t),e&&this._updateValueIndicatorUI(e)}_updateTickMarkTrackUI(){if(!this.showTickMarks||this._skipUpdate())return;let t=this._step&&this._step>0?this._step:1,e=(Math.floor(this.max/t)*t-this.min)/(this.max-this.min);this._tickMarkTrackWidth=(this._cachedWidth-6)*e}_updateTrackUI(t){this._skipUpdate()||(this._isRange?this._updateTrackUIRange(t):this._updateTrackUINonRange(t))}_updateTrackUIRange(t){let e=t.getSibling();if(!e||!this._cachedWidth)return;let i=Math.abs(e.translateX-t.translateX)/this._cachedWidth;t._isLeftThumb&&this._cachedWidth?this._setTrackActiveStyles({left:"auto",right:`${this._cachedWidth-e.translateX}px`,transformOrigin:"right",transform:`scaleX(${i})`}):this._setTrackActiveStyles({left:`${e.translateX}px`,right:"auto",transformOrigin:"left",transform:`scaleX(${i})`})}_updateTrackUINonRange(t){this._isRtl()?this._setTrackActiveStyles({left:"auto",right:"0px",transformOrigin:"right",transform:`scaleX(${1-t.fillPercentage})`}):this._setTrackActiveStyles({left:"0px",right:"auto",transformOrigin:"left",transform:`scaleX(${t.fillPercentage})`})}_updateTickMarkUI(){if(!this.showTickMarks||this.step===void 0||this.min===void 0||this.max===void 0)return;let t=this.step>0?this.step:1;this._isRange?this._updateTickMarkUIRange(t):this._updateTickMarkUINonRange(t)}_updateTickMarkUINonRange(t){let e=this._getValue(),i=Math.max(Math.round((e-this.min)/t),0)+1,d=Math.max(Math.round((this.max-e)/t),0)-1;this._isRtl()?i++:d++,this._tickMarks=Array(i).fill(A.ACTIVE).concat(Array(d).fill(A.INACTIVE))}_updateTickMarkUIRange(t){let e=this._getValue(),i=this._getValue(r.START),d=Math.max(Math.round((i-this.min)/t),0),u=Math.max(Math.round((e-i)/t)+1,0),b=Math.max(Math.round((this.max-e)/t),0);this._tickMarks=Array(d).fill(A.INACTIVE).concat(Array(u).fill(A.ACTIVE),Array(b).fill(A.INACTIVE))}_getInput(t){if(t===r.END&&this._input)return this._input;if(this._inputs?.length)return t===r.START?this._inputs.first:this._inputs.last}_getThumb(t){return t===r.END?this._thumbs?.last:this._thumbs?.first}_setTransition(t){this._hasAnimation=!this._platform.IOS&&t&&!this._noopAnimations,this._elementRef.nativeElement.classList.toggle("mat-mdc-slider-with-animation",this._hasAnimation)}_isCursorOnSliderThumb(t,e){let i=e.width/2,d=e.x+i,u=e.y+i,b=t.clientX-d,T=t.clientY-u;return Math.pow(b,2)+Math.pow(T,2)<Math.pow(i,2)}static \u0275fac=function(t){return new(t||s)};static \u0275cmp=Z({type:s,selectors:[["mat-slider"]],contentQueries:function(t,e,i){if(t&1&&It(i,ut,5)(i,mt,4),t&2){let d;R(d=N())&&(e._input=d.first),R(d=N())&&(e._inputs=d)}},viewQuery:function(t,e){if(t&1&&at(ie,5)(_t,5),t&2){let i;R(i=N())&&(e._trackActive=i.first),R(i=N())&&(e._thumbs=i)}},hostAttrs:[1,"mat-mdc-slider","mdc-slider"],hostVars:12,hostBindings:function(t,e){t&2&&(it("mat-"+(e.color||"primary")),Ct("mdc-slider--range",e._isRange)("mdc-slider--disabled",e.disabled)("mdc-slider--discrete",e.discrete)("mdc-slider--tick-marks",e.showTickMarks)("_mat-animation-noopable",e._noopAnimations))},inputs:{disabled:[2,"disabled","disabled",U],discrete:[2,"discrete","discrete",U],showTickMarks:[2,"showTickMarks","showTickMarks",U],min:[2,"min","min",y],color:"color",disableRipple:[2,"disableRipple","disableRipple",U],max:[2,"max","max",y],step:[2,"step","step",y],displayWith:"displayWith"},exportAs:["matSlider"],features:[$([{provide:J,useExisting:s}])],ngContentSelectors:ae,decls:9,vars:5,consts:[["trackActive",""],["tickMarkContainer",""],[1,"mdc-slider__track"],[1,"mdc-slider__track--inactive"],[1,"mdc-slider__track--active"],[1,"mdc-slider__track--active_fill"],[1,"mdc-slider__tick-marks"],[3,"discrete","thumbPosition","valueIndicatorText"],[3,"class","transform"]],template:function(t,e){t&1&&(yt(),St(0),h(1,"div",2),w(2,"div",3),h(3,"div",4),w(4,"div",5,0),o(),E(6,ne,3,1,"div",6),o(),E(7,le,1,3,"mat-slider-visual-thumb",7),w(8,"mat-slider-visual-thumb",7)),t&2&&(n(6),O(e.showTickMarks?6:-1),n(),O(e._isRange?7:-1),n(),_("discrete",e.discrete)("thumbPosition",2)("valueIndicatorText",e.endValueIndicatorText))},dependencies:[oe],styles:[`.mdc-slider__track {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 100%;
  pointer-events: none;
  height: var(--%NS%mat-slider-inactive-track-height, 4px);
}

.mdc-slider__track--active,
.mdc-slider__track--inactive {
  display: flex;
  height: 100%;
  position: absolute;
  width: 100%;
}

.mdc-slider__track--active {
  overflow: hidden;
  border-radius: var(--%NS%mat-slider-active-track-shape, var(--%NS%mat-sys-corner-full));
  height: var(--%NS%mat-slider-active-track-height, 4px);
  top: calc((var(--%NS%mat-slider-inactive-track-height, 4px) - var(--%NS%mat-slider-active-track-height, 4px)) / 2);
}

.mdc-slider__track--active_fill {
  border-top-style: solid;
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  position: relative;
  transform-origin: left;
  transition: transform 80ms ease;
  border-color: var(--%NS%mat-slider-active-track-color, var(--%NS%mat-sys-primary));
  border-top-width: var(--%NS%mat-slider-active-track-height, 4px);
}
.mdc-slider--disabled .mdc-slider__track--active_fill {
  border-color: var(--%NS%mat-slider-disabled-active-track-color, var(--%NS%mat-sys-on-surface));
}
[dir=rtl] .mdc-slider__track--active_fill {
  -webkit-transform-origin: right;
  transform-origin: right;
}

.mdc-slider__track--inactive {
  left: 0;
  top: 0;
  opacity: 0.24;
  background-color: var(--%NS%mat-slider-inactive-track-color, var(--%NS%mat-sys-surface-variant));
  height: var(--%NS%mat-slider-inactive-track-height, 4px);
  border-radius: var(--%NS%mat-slider-inactive-track-shape, var(--%NS%mat-sys-corner-full));
}
.mdc-slider--disabled .mdc-slider__track--inactive {
  background-color: var(--%NS%mat-slider-disabled-inactive-track-color, var(--%NS%mat-sys-on-surface));
  opacity: 0.24;
}
.mdc-slider__track--%NS%inactive::before {
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
@media (forced-colors: active) {
  .mdc-slider__track--%NS%inactive::before {
    border-color: CanvasText;
  }
}

.mdc-slider__value-indicator-container {
  bottom: 44px;
  left: 50%;
  pointer-events: none;
  position: absolute;
  transform: var(--%NS%mat-slider-value-indicator-container-transform, translateX(-50%) rotate(-45deg));
}
.mdc-slider__thumb--with-indicator .mdc-slider__value-indicator-container {
  pointer-events: auto;
}

.mdc-slider__value-indicator {
  display: flex;
  align-items: center;
  transform: scale(0);
  transform-origin: var(--%NS%mat-slider-value-indicator-transform-origin, 0 28px);
  transition: transform 100ms cubic-bezier(0.4, 0, 1, 1);
  word-break: normal;
  background-color: var(--%NS%mat-slider-label-container-color, var(--%NS%mat-sys-primary));
  color: var(--%NS%mat-slider-label-label-text-color, var(--%NS%mat-sys-on-primary));
  width: var(--%NS%mat-slider-value-indicator-width, 28px);
  height: var(--%NS%mat-slider-value-indicator-height, 28px);
  padding: var(--%NS%mat-slider-value-indicator-padding, 0);
  opacity: var(--%NS%mat-slider-value-indicator-opacity, 1);
  border-radius: var(--%NS%mat-slider-value-indicator-border-radius, 50% 50% 50% 0);
}
.mdc-slider__thumb--with-indicator .mdc-slider__value-indicator {
  transition: transform 100ms cubic-bezier(0, 0, 0.2, 1);
  transform: scale(1);
}
.mdc-slider__value-indicator::before {
  border-left: 6px solid transparent;
  border-right: 6px solid transparent;
  border-top: 6px solid;
  bottom: -5px;
  content: "";
  height: 0;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 0;
  display: var(--%NS%mat-slider-value-indicator-caret-display, none);
  border-top-color: var(--%NS%mat-slider-label-container-color, var(--%NS%mat-sys-primary));
}
.mdc-slider__value-indicator::after {
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
@media (forced-colors: active) {
  .mdc-slider__value-indicator::after {
    border-color: CanvasText;
  }
}

.mdc-slider__value-indicator-text {
  text-align: center;
  width: var(--%NS%mat-slider-value-indicator-width, 28px);
  transform: var(--%NS%mat-slider-value-indicator-text-transform, rotate(45deg));
  font-family: var(--%NS%mat-slider-label-label-text-font, var(--%NS%mat-sys-label-medium-font));
  font-size: var(--%NS%mat-slider-label-label-text-size, var(--%NS%mat-sys-label-medium-size));
  font-weight: var(--%NS%mat-slider-label-label-text-weight, var(--%NS%mat-sys-label-medium-weight));
  line-height: var(--%NS%mat-slider-label-label-text-line-height, var(--%NS%mat-sys-label-medium-line-height));
  letter-spacing: var(--%NS%mat-slider-label-label-text-tracking, var(--%NS%mat-sys-label-medium-tracking));
}

.mdc-slider__thumb {
  -webkit-user-select: none;
  user-select: none;
  display: flex;
  left: -24px;
  outline: none;
  position: absolute;
  height: 48px;
  width: 48px;
  pointer-events: none;
}
.mdc-slider--discrete .mdc-slider__thumb {
  transition: transform 80ms ease;
}
.mdc-slider--disabled .mdc-slider__thumb {
  pointer-events: none;
}

.mdc-slider__thumb--top {
  z-index: 1;
}

.mdc-slider__thumb-knob {
  position: absolute;
  box-sizing: border-box;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  border-style: solid;
  width: var(--%NS%mat-slider-handle-width, 20px);
  height: var(--%NS%mat-slider-handle-height, 20px);
  border-width: calc(var(--%NS%mat-slider-handle-height, 20px) / 2) calc(var(--%NS%mat-slider-handle-width, 20px) / 2);
  box-shadow: var(--%NS%mat-slider-handle-elevation, var(--%NS%mat-sys-level1));
  background-color: var(--%NS%mat-slider-handle-color, var(--%NS%mat-sys-primary));
  border-color: var(--%NS%mat-slider-handle-color, var(--%NS%mat-sys-primary));
  border-radius: var(--%NS%mat-slider-handle-shape, var(--%NS%mat-sys-corner-full));
}
.mdc-slider__thumb:hover .mdc-slider__thumb-knob {
  background-color: var(--%NS%mat-slider-hover-handle-color, var(--%NS%mat-sys-primary));
  border-color: var(--%NS%mat-slider-hover-handle-color, var(--%NS%mat-sys-primary));
}
.mdc-slider__thumb--focused .mdc-slider__thumb-knob {
  background-color: var(--%NS%mat-slider-focus-handle-color, var(--%NS%mat-sys-primary));
  border-color: var(--%NS%mat-slider-focus-handle-color, var(--%NS%mat-sys-primary));
}
.mdc-slider--disabled .mdc-slider__thumb-knob {
  background-color: var(--%NS%mat-slider-disabled-handle-color, var(--%NS%mat-sys-on-surface));
  border-color: var(--%NS%mat-slider-disabled-handle-color, var(--%NS%mat-sys-on-surface));
}
.mdc-slider__thumb--top .mdc-slider__thumb-knob, .mdc-slider__thumb--top.mdc-slider__thumb:hover .mdc-slider__thumb-knob, .mdc-slider__thumb--top.mdc-slider__thumb--focused .mdc-slider__thumb-knob {
  border: solid 1px #fff;
  box-sizing: content-box;
  border-color: var(--%NS%mat-slider-with-overlap-handle-outline-color, var(--%NS%mat-sys-on-primary));
  border-width: var(--%NS%mat-slider-with-overlap-handle-outline-width, 1px);
}

.mdc-slider__tick-marks {
  align-items: center;
  box-sizing: border-box;
  display: flex;
  height: 100%;
  justify-content: space-between;
  padding: 0 1px;
  position: absolute;
  width: 100%;
}

.mdc-slider__tick-mark--active,
.mdc-slider__tick-mark--inactive {
  width: var(--%NS%mat-slider-with-tick-marks-container-size, 2px);
  height: var(--%NS%mat-slider-with-tick-marks-container-size, 2px);
  border-radius: var(--%NS%mat-slider-with-tick-marks-container-shape, var(--%NS%mat-sys-corner-full));
}

.mdc-slider__tick-mark--inactive {
  opacity: var(--%NS%mat-slider-with-tick-marks-inactive-container-opacity, 0.38);
  background-color: var(--%NS%mat-slider-with-tick-marks-inactive-container-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-slider--disabled .mdc-slider__tick-mark--inactive {
  opacity: var(--%NS%mat-slider-with-tick-marks-inactive-container-opacity, 0.38);
  background-color: var(--%NS%mat-slider-with-tick-marks-disabled-container-color, var(--%NS%mat-sys-on-surface));
}

.mdc-slider__tick-mark--active {
  opacity: var(--%NS%mat-slider-with-tick-marks-active-container-opacity, 0.38);
  background-color: var(--%NS%mat-slider-with-tick-marks-active-container-color, var(--%NS%mat-sys-on-primary));
}

.mdc-slider__input {
  cursor: pointer;
  left: 2px;
  margin: 0;
  height: 44px;
  opacity: 0;
  position: absolute;
  top: 2px;
  width: 44px;
  box-sizing: content-box;
}
.mdc-slider__input.mat-mdc-slider-input-no-pointer-events {
  pointer-events: none;
}
.mdc-slider__input.mat-slider__right-input {
  left: auto;
  right: 0;
}

.mat-mdc-slider {
  display: inline-block;
  box-sizing: border-box;
  outline: none;
  vertical-align: middle;
  cursor: pointer;
  height: 48px;
  margin: 0 8px;
  position: relative;
  touch-action: pan-y;
  width: auto;
  min-width: 112px;
  -webkit-tap-highlight-color: transparent;
}
.mat-mdc-slider.mdc-slider--disabled {
  cursor: auto;
  opacity: 0.38;
}
.mat-mdc-slider.mdc-slider--disabled .mdc-slider__input {
  cursor: auto;
}
.mat-mdc-slider .mdc-slider__thumb,
.mat-mdc-slider .mdc-slider__track--active_fill {
  transition-duration: 0ms;
}
.mat-mdc-slider.mat-mdc-slider-with-animation .mdc-slider__thumb,
.mat-mdc-slider.mat-mdc-slider-with-animation .mdc-slider__track--active_fill {
  transition-duration: 80ms;
}
.mat-mdc-slider.mdc-slider--discrete .mdc-slider__thumb,
.mat-mdc-slider.mdc-slider--discrete .mdc-slider__track--active_fill {
  transition-duration: 0ms;
}
.mat-mdc-slider.mat-mdc-slider-with-animation .mdc-slider__thumb,
.mat-mdc-slider.mat-mdc-slider-with-animation .mdc-slider__track--active_fill {
  transition-duration: 80ms;
}
.mat-mdc-slider .mat-ripple .mat-ripple-element {
  background-color: var(--%NS%mat-slider-ripple-color, var(--%NS%mat-sys-primary));
}
.mat-mdc-slider .mat-ripple .mat-mdc-slider-hover-ripple {
  background-color: var(--%NS%mat-slider-hover-state-layer-color, color-mix(in srgb, var(--%NS%mat-sys-primary) 5%, transparent));
}
.mat-mdc-slider .mat-ripple .mat-mdc-slider-focus-ripple,
.mat-mdc-slider .mat-ripple .mat-mdc-slider-active-ripple {
  background-color: var(--%NS%mat-slider-focus-state-layer-color, color-mix(in srgb, var(--%NS%mat-sys-primary) 20%, transparent));
}
.mat-mdc-slider._mat-animation-noopable.mdc-slider--discrete .mdc-slider__thumb, .mat-mdc-slider._mat-animation-noopable.mdc-slider--discrete .mdc-slider__track--active_fill,
.mat-mdc-slider._mat-animation-noopable .mdc-slider__value-indicator {
  transition: none;
}
.mat-mdc-slider .mat-focus-indicator::before {
  border-radius: 50%;
}

.mdc-slider__thumb--focused .mat-focus-indicator::before {
  content: "";
}
`],encapsulation:2})}return s})(),he={provide:dt,useExisting:nt(()=>pt),multi:!0},ce={provide:dt,useExisting:nt(()=>gt),multi:!0},pt=(()=>{class s{_ngZone=c(j);_elementRef=c(Q);_cdr=c(X);_slider=c(J);_platform=c(Y);_listenerCleanups;get value(){return y(this._hostElement.value,0)}set value(t){t===null&&(t=this._getDefaultValue()),t=isNaN(t)?0:t;let e=t+"";if(!this._hasSetInitialValue){this._initialValue=e;return}this._isActive||this._setValue(e)}_setValue(t){this._hostElement.value=t,this._updateThumbUIByValue(),this._slider._onValueChange(this),this._cdr.detectChanges(),this._slider._cdr.markForCheck()}valueChange=new W;dragStart=new W;dragEnd=new W;get translateX(){return this._slider.min>=this._slider.max?(this._translateX=this._tickMarkOffset,this._translateX):(this._translateX===void 0&&(this._translateX=this._calcTranslateXByValue()),this._translateX)}set translateX(t){this._translateX=t}_translateX;thumbPosition=r.END;get min(){return y(this._hostElement.min,0)}set min(t){this._hostElement.min=t+"",this._cdr.detectChanges()}get max(){return y(this._hostElement.max,0)}set max(t){this._hostElement.max=t+"",this._cdr.detectChanges()}get step(){return y(this._hostElement.step,0)}set step(t){this._hostElement.step=t+"",this._cdr.detectChanges()}get disabled(){return U(this._hostElement.disabled)}set disabled(t){this._hostElement.disabled=t,this._cdr.detectChanges(),this._slider.disabled!==this.disabled&&(this._slider.disabled=this.disabled)}get percentage(){return this._slider.min>=this._slider.max?this._slider._isRtl()?1:0:(this.value-this._slider.min)/(this._slider.max-this._slider.min)}get fillPercentage(){return this._slider._cachedWidth?this._translateX===0?0:this.translateX/this._slider._cachedWidth:this._slider._isRtl()?1:0}_hostElement=this._elementRef.nativeElement;_valuetext=et("");_knobRadius=8;_tickMarkOffset=3;_isActive=!1;_isFocused=!1;_setIsFocused(t){this._isFocused=t}_hasSetInitialValue=!1;_initialValue;_formControl;_destroyed=new Rt;_skipUIUpdate=!1;_onChangeFn;_onTouchedFn=()=>{};_isControlInitialized=!1;constructor(){let t=c(rt);this._ngZone.runOutsideAngular(()=>{this._listenerCleanups=[t.listen(this._hostElement,"pointerdown",this._onPointerDown.bind(this)),t.listen(this._hostElement,"pointermove",this._onPointerMove.bind(this)),t.listen(this._hostElement,"pointerup",this._onPointerUp.bind(this))]})}ngOnDestroy(){this._listenerCleanups.forEach(t=>t()),this._destroyed.next(),this._destroyed.complete(),this.dragStart.complete(),this.dragEnd.complete()}initProps(){this._updateWidthInactive(),this.disabled!==this._slider.disabled&&(this._slider.disabled=!0),this.step=this._slider.step,this.min=this._slider.min,this.max=this._slider.max,this._initValue()}initUI(){this._updateThumbUIByValue()}_initValue(){this._hasSetInitialValue=!0,this._initialValue===void 0?this.value=this._getDefaultValue():(this._hostElement.value=this._initialValue,this._updateThumbUIByValue(),this._slider._onValueChange(this),this._cdr.detectChanges())}_getDefaultValue(){return this.min}_onBlur(){this._setIsFocused(!1),this._onTouchedFn()}_onFocus(){this._slider._setTransition(!1),this._slider._updateTrackUI(this),this._setIsFocused(!0)}_onChange(){this.valueChange.emit(this.value),this._isActive&&this._updateThumbUIByValue({withAnimation:!0})}_onInput(){this._onChangeFn?.(this.value),(this._slider.step||!this._isActive)&&this._updateThumbUIByValue({withAnimation:!this._isActive}),this._slider._onValueChange(this)}_onNgControlValueChange(){(!this._isActive||!this._isFocused)&&(this._slider._onValueChange(this),this._updateThumbUIByValue()),this._slider.disabled=this._formControl.disabled}_onPointerDown(t){if(!(this.disabled||t.button!==0)){if(this._platform.IOS){let e=this._slider._isCursorOnSliderThumb(t,this._slider._getThumb(this.thumbPosition)._hostElement.getBoundingClientRect());this._isActive=e,this._updateWidthActive(),this._slider._updateDimensions();return}this._isActive=!0,this._setIsFocused(!0),this._updateWidthActive(),this._slider._updateDimensions(),this._slider.step||this._updateThumbUIByPointerEvent(t,{withAnimation:!0}),this.disabled||(this._handleValueCorrection(t),this.dragStart.emit({source:this,parent:this._slider,value:this.value}))}}_handleValueCorrection(t){this._skipUIUpdate=!0,setTimeout(()=>{this._skipUIUpdate=!1,this._fixValue(t)},0)}_fixValue(t){let e=t.clientX-this._slider._cachedLeft,i=this._slider._cachedWidth,d=this._slider.step===0?1:this._slider.step,u=Math.floor((this._slider.max-this._slider.min)/d),b=this._slider._isRtl()?1-e/i:e/i,T=Math.round(b*u)/u*(this._slider.max-this._slider.min)+this._slider.min,V=Math.round(T/d)*d;if(V===this.value){this._slider._onValueChange(this),this._slider.step>0?this._updateThumbUIByValue():this._updateThumbUIByPointerEvent(t,{withAnimation:this._slider._hasAnimation});return}this.value=V,this.valueChange.emit(this.value),this._onChangeFn?.(this.value),this._slider._onValueChange(this),this._slider.step>0?this._updateThumbUIByValue():this._updateThumbUIByPointerEvent(t,{withAnimation:this._slider._hasAnimation})}_onPointerMove(t){!this._slider.step&&this._isActive&&this._updateThumbUIByPointerEvent(t)}_onPointerUp(){this._isActive&&(this._isActive=!1,this._platform.SAFARI&&this._setIsFocused(!1),this.dragEnd.emit({source:this,parent:this._slider,value:this.value}),setTimeout(()=>this._updateWidthInactive(),this._platform.IOS?10:0))}_clamp(t){let e=this._tickMarkOffset,i=this._slider._cachedWidth-this._tickMarkOffset;return Math.max(Math.min(t,i),e)}_calcTranslateXByValue(){return this._slider._isRtl()?(1-this.percentage)*(this._slider._cachedWidth-this._tickMarkOffset*2)+this._tickMarkOffset:this.percentage*(this._slider._cachedWidth-this._tickMarkOffset*2)+this._tickMarkOffset}_calcTranslateXByPointerEvent(t){return t.clientX-this._slider._cachedLeft}_updateWidthActive(){}_updateWidthInactive(){this._hostElement.style.padding=`0 ${this._slider._inputPadding}px`,this._hostElement.style.width=`calc(100% + ${this._slider._inputPadding-this._tickMarkOffset*2}px)`,this._hostElement.style.left=`-${this._slider._rippleRadius-this._tickMarkOffset}px`}_updateThumbUIByValue(t){this.translateX=this._clamp(this._calcTranslateXByValue()),this._updateThumbUI(t)}_updateThumbUIByPointerEvent(t,e){this.translateX=this._clamp(this._calcTranslateXByPointerEvent(t)),this._updateThumbUI(e)}_updateThumbUI(t){this._slider._setTransition(!!t?.withAnimation),this._slider._onTranslateXChange(this)}writeValue(t){(this._isControlInitialized||t!==null)&&(this.value=t)}registerOnChange(t){this._onChangeFn=t,this._isControlInitialized=!0}registerOnTouched(t){this._onTouchedFn=t}setDisabledState(t){this.disabled=t}focus(){this._hostElement.focus()}blur(){this._hostElement.blur()}static \u0275fac=function(t){return new(t||s)};static \u0275dir=st({type:s,selectors:[["input","matSliderThumb",""]],hostAttrs:["type","range",1,"mdc-slider__input"],hostVars:1,hostBindings:function(t,e){t&1&&M("change",function(){return e._onChange()})("input",function(){return e._onInput()})("blur",function(){return e._onBlur()})("focus",function(){return e._onFocus()}),t&2&&x("aria-valuetext",e._valuetext())},inputs:{value:[2,"value","value",y]},outputs:{valueChange:"valueChange",dragStart:"dragStart",dragEnd:"dragEnd"},exportAs:["matSliderThumb"],features:[$([he,{provide:ut,useExisting:s}])]})}return s})(),gt=(()=>{class s extends pt{_cdr=c(X);getSibling(){return this._sibling||(this._sibling=this._slider._getInput(this._isEndThumb?r.START:r.END)),this._sibling}_sibling;getMinPos(){let t=this.getSibling();return!this._isLeftThumb&&t?t.translateX:this._tickMarkOffset}getMaxPos(){let t=this.getSibling();return this._isLeftThumb&&t?t.translateX:this._slider._cachedWidth-this._tickMarkOffset}_setIsLeftThumb(){this._isLeftThumb=this._isEndThumb&&this._slider._isRtl()||!this._isEndThumb&&!this._slider._isRtl()}_isLeftThumb=!1;_isEndThumb=!1;constructor(){super(),this._isEndThumb=this._hostElement.hasAttribute("matSliderEndThumb"),this._setIsLeftThumb(),this.thumbPosition=this._isEndThumb?r.END:r.START}_getDefaultValue(){return this._isEndThumb&&this._slider._isRange?this.max:this.min}_onInput(){super._onInput(),this._updateSibling(),this._isActive||this._updateWidthInactive()}_onNgControlValueChange(){super._onNgControlValueChange(),this.getSibling()?._updateMinMax()}_onPointerDown(t){this.disabled||t.button!==0||(this._sibling&&(this._sibling._updateWidthActive(),this._sibling._hostElement.classList.add("mat-mdc-slider-input-no-pointer-events")),super._onPointerDown(t))}_onPointerUp(){super._onPointerUp(),this._sibling&&setTimeout(()=>{this._sibling._updateWidthInactive(),this._sibling._hostElement.classList.remove("mat-mdc-slider-input-no-pointer-events")})}_onPointerMove(t){super._onPointerMove(t),!this._slider.step&&this._isActive&&this._updateSibling()}_fixValue(t){super._fixValue(t),this._sibling?._updateMinMax()}_clamp(t){return Math.max(Math.min(t,this.getMaxPos()),this.getMinPos())}_updateMinMax(){let t=this.getSibling();t&&(this._isEndThumb?(this.min=Math.max(this._slider.min,t.value),this.max=this._slider.max):(this.min=this._slider.min,this.max=Math.min(this._slider.max,t.value)))}_updateWidthActive(){let t=this._slider._rippleRadius*2-this._slider._inputPadding*2,e=(this._slider._cachedWidth+this._slider._inputPadding-t-this._tickMarkOffset*2)*(this._slider.min<this._slider.max?(this.max-this.min)/(this._slider.max-this._slider.min):1)+t;this._hostElement.style.width=`${e}px`,this._hostElement.style.padding=`0 ${this._slider._inputPadding}px`}_updateWidthInactive(){let t=this.getSibling();if(!t)return;let e=this._slider._cachedWidth-this._tickMarkOffset*2,i=this._isEndThumb?this.value-(this.value-t.value)/2:this.value+(t.value-this.value)/2,d=this._isEndThumb?(this.max-i)/(this._slider.max-this._slider.min):(i-this.min)/(this._slider.max-this._slider.min),u=this._slider.min<this._slider.max?d:1,b=this._slider._rippleRadius;u===1?b=48:u===0&&(b=0);let T=e*u+b;this._hostElement.style.width=`${T}px`,this._hostElement.style.padding="0px",this._isLeftThumb?(this._hostElement.style.left=`-${this._slider._rippleRadius-this._tickMarkOffset}px`,this._hostElement.style.right="auto"):(this._hostElement.style.left="auto",this._hostElement.style.right=`-${this._slider._rippleRadius-this._tickMarkOffset}px`)}_updateStaticStyles(){this._hostElement.classList.toggle("mat-slider__right-input",!this._isLeftThumb)}_updateSibling(){let t=this.getSibling();t&&(t._updateMinMax(),this._isActive?t._updateWidthActive():t._updateWidthInactive())}writeValue(t){(this._isControlInitialized||t!==null)&&(this.value=t,this._updateWidthInactive(),this._updateSibling())}_setValue(t){super._setValue(t),this._updateWidthInactive(),this._updateSibling()}static \u0275fac=function(t){return new(t||s)};static \u0275dir=st({type:s,selectors:[["input","matSliderStartThumb",""],["input","matSliderEndThumb",""]],exportAs:["matSliderRangeThumb"],features:[$([ce,{provide:mt,useExisting:s}]),wt]})}return s})(),ue=(()=>{class s{static \u0275fac=function(t){return new(t||s)};static \u0275mod=Mt({type:s});static \u0275inj=kt({imports:[zt,Wt]})}return s})();function me(s,a){s&1&&w(0,"app-form-flow",1),s&2&&_("loading",!0)}function _e(s,a){if(s&1){let t=F();h(0,"div",13)(1,"span"),f(2),p(3,"i18n"),o(),h(4,"app-menu",19),M("itemSelect",function(e){S(t);let i=m(3);return C(i.onGameFilterMenuSelect(e))}),o()()}if(s&2){let t=a.$implicit,e=m(3);n(2),v(g(3,6,e.filterMenuTitle(t))),n(2),_("title",e.filterMenuTitle(t))("filterable",e.filterMenuSearchable(t))("trigger",e.filterMenuTrigger(t))("model",e.filterMenuModel(t)),x("data-guide-control","home-filter-"+t)}}function pe(s,a){if(s&1){let t=F();h(0,"div",13)(1,"span"),f(2),p(3,"i18n"),o(),h(4,"app-menu",19),M("itemSelect",function(e){S(t);let i=m(3);return C(i.onGameFilterMenuSelect(e))}),o()()}if(s&2){let t=a.$implicit,e=m(3);n(2),v(g(3,6,e.filterMenuTitle(t))),n(2),_("title",e.filterMenuTitle(t))("filterable",e.filterMenuSearchable(t))("trigger",e.filterMenuTrigger(t))("model",e.filterMenuModel(t)),x("data-guide-control","home-filter-"+t)}}function ge(s,a){if(s&1){let t=F();h(0,"div",13)(1,"span"),f(2),p(3,"i18n"),o(),h(4,"app-menu",19),M("itemSelect",function(e){S(t);let i=m(3);return C(i.onGameFilterMenuSelect(e))}),o()()}if(s&2){let t=a.$implicit,e=m(3);n(2),v(g(3,6,e.filterMenuTitle(t))),n(2),_("title",e.filterMenuTitle(t))("filterable",e.filterMenuSearchable(t))("trigger",e.filterMenuTrigger(t))("model",e.filterMenuModel(t)),x("data-guide-control","home-filter-"+t)}}function fe(s,a){if(s&1){let t=F();h(0,"div",13)(1,"span"),f(2),p(3,"i18n"),o(),h(4,"app-menu",19),M("itemSelect",function(e){S(t);let i=m(3);return C(i.onGameFilterMenuSelect(e))}),o()()}if(s&2){let t=a.$implicit,e=m(3);n(2),v(g(3,6,e.filterMenuTitle(t))),n(2),_("title",e.filterMenuTitle(t))("filterable",e.filterMenuSearchable(t))("trigger",e.filterMenuTrigger(t))("model",e.filterMenuModel(t)),x("data-guide-control","home-filter-"+t)}}function be(s,a){if(s&1){let t=F();h(0,"div",2)(1,"div",3)(2,"div",4)(3,"section",5)(4,"div",6)(5,"h3"),f(6),p(7,"i18n"),o()(),h(8,"div",7)(9,"h4"),f(10),p(11,"i18n"),o(),h(12,"span",8),f(13),o()(),h(14,"div",9)(15,"mat-slider",10)(16,"input",11),p(17,"i18n"),G(),M("ngModelChange",function(e){S(t);let i=m(2);return C(i.onAgeMinChange(e))}),o(),h(18,"input",12),p(19,"i18n"),G(),M("ngModelChange",function(e){S(t);let i=m(2);return C(i.onAgeMaxChange(e))}),o()()(),h(20,"div",7)(21,"h4"),f(22),p(23,"i18n"),o(),h(24,"span",8),f(25),o()(),h(26,"div",9)(27,"mat-slider",10)(28,"input",11),p(29,"i18n"),G(),M("ngModelChange",function(e){S(t);let i=m(2);return C(i.onHeightMinChange(e))}),o(),h(30,"input",12),p(31,"i18n"),G(),M("ngModelChange",function(e){S(t);let i=m(2);return C(i.onHeightMaxChange(e))}),o()()(),B(32,_e,5,8,"div",13,K),o(),h(34,"section",14)(35,"div",6)(36,"h3"),f(37),p(38,"i18n"),o()(),B(39,pe,5,8,"div",13,K),o()(),h(41,"div",15)(42,"section",16)(43,"div",6)(44,"h3"),f(45),p(46,"i18n"),o()(),B(47,ge,5,8,"div",13,K),o()(),h(49,"div",17)(50,"section",18)(51,"div",6)(52,"h3"),f(53),p(54,"i18n"),o()(),B(55,fe,5,8,"div",13,K),o()()()()}if(s&2){let t=m(2);n(6),v(g(7,24,"basics")),n(4),v(g(11,26,"age.range")),n(3),lt("",t.filterDraft.ageMin," - ",t.filterDraft.ageMax),n(2),_("min",t.minAgeBound)("max",t.maxAgeBound)("step",1),n(),_("ngModel",t.filterDraft.ageMin),x("aria-label",g(17,28,"age.range")+" min"),q(),n(2),_("ngModel",t.filterDraft.ageMax),x("aria-label",g(19,30,"age.range")+" max"),q(),n(4),v(g(23,32,"height.range.cm")),n(3),lt("",t.filterDraft.heightMinCm," - ",t.filterDraft.heightMaxCm),n(2),_("min",t.minHeightBoundCm)("max",t.maxHeightBoundCm)("step",1),n(),_("ngModel",t.filterDraft.heightMinCm),x("aria-label",g(29,34,"height.range.cm")+" min"),q(),n(2),_("ngModel",t.filterDraft.heightMaxCm),x("aria-label",g(31,36,"height.range.cm")+" max"),q(),n(2),L(t.basicsFilterMenuKinds),n(5),v(g(38,38,"beliefs")),n(2),L(t.beliefsFilterMenuKinds),n(6),v(g(46,40,"lifestyle")),n(2),L(t.lifestyleFilterMenuKinds),n(6),v(g(54,42,"relationships")),n(2),L(t.relationshipFilterMenuKinds)}}function ve(s,a){if(s&1&&(h(0,"app-popup",0),E(1,me,1,1,"app-form-flow",1)(2,be,57,44,"div",2),o()),s&2){let t=m();_("model",t.gameFilterPopupModel())("zIndex",t.gameFilterPopupZIndex()),n(),O(t.preparing()?1:2)}}var Me=class tt{context=null;saving=!1;closed=new W;filterDraft;preparing=et(!0);cancelPreparation=null;explanationGuide=c(Et);unregisterExplanationContext=null;cachedProfileFieldMenus=null;menuModels=new Map;get profileFieldMenus(){return this.cachedProfileFieldMenus??=new Map(Zt.convert(null,{imageEditor:"external",showHeader:!1,showSave:!1}).steps.flatMap(a=>a.controls??[]).filter(a=>a.kind==="menu").map(a=>[a.id,a.config]))}ngAfterViewInit(){this.cancelPreparation=Ot(()=>{this.preparing.set(!1),this.cancelPreparation=null})}ngOnDestroy(){this.cancelPreparation?.(),this.unregisterExplanationContext?.(),this.unregisterExplanationContext=null}profileFieldIds={interests:"interests",values:"values",physiques:"physique",languages:"languages",genders:"gender",smoking:"smoking",drinking:"drinking",workout:"workout",pets:"pets",familyPlans:"familyPlans",children:"children",loveStyles:"loveStyle",communicationStyles:"communicationStyle",sexualOrientations:"sexualOrientation",religions:"religion"};basicsFilterMenuKinds=["horoscopes","languages"];beliefsFilterMenuKinds=["values","religions"];lifestyleFilterMenuKinds=["interests","physiques","smoking","drinking","workout","pets"];relationshipFilterMenuKinds=["genders","traitLabels","familyPlans","children","loveStyles","communicationStyles","sexualOrientations"];ngOnChanges(a){a.context&&(this.context?this.unregisterExplanationContext??=this.explanationGuide.registerContext("home.filters"):(this.unregisterExplanationContext?.(),this.unregisterExplanationContext=null),this.context&&(this.filterDraft=Qt(this.context.filter)))}onEscapePressed(a){a.defaultPrevented||(a.preventDefault(),a.stopPropagation(),this.requestClose())}get minAgeBound(){return 18}get maxAgeBound(){return 120}get minHeightBoundCm(){return 40}get maxHeightBoundCm(){return 250}gameFilterPopupModel(){return{title:"game.filters",ariaLabel:"home.filters.aria",closeAriaLabel:"close.filter.popup",size:"wide",height:"full",headerTone:"accent",bodyLayout:"fill",backdropTone:"dim",closeOnBackdrop:!this.saving,headerControls:this.gameFilterPopupHeaderControls(),onClose:a=>this.requestClose(a),onMenuSelect:a=>this.onGameFilterMenuSelect(a.itemSelect)}}gameFilterPopupZIndex(){return 10020}gameFilterPopupHeaderControls(){return[{kind:"menu",id:"game-filter-actions",menuKind:"inline",items:this.gameFilterPopupActionItems(),panelAlign:"end",closeOnSelect:!1}]}gameFilterPopupActionItems(){return[{id:"game-filter-apply",icon:"check",kind:"action",palette:"green",disabled:this.saving||this.preparing(),ariaLabel:this.saving?"saving.filters":"apply.filters",progress:this.saving?{state:"loading",shape:"circle"}:null,context:{kind:"apply"}}]}filterMenuTitle(a){return{interests:"interest",values:"values",physiques:"physique",languages:"profile.languages",genders:"gender",horoscopes:"profile.horoscope",traitLabels:"top.trait",smoking:"smoking",drinking:"drinking",workout:"workout",pets:"pets",familyPlans:"family.plans",children:"children",loveStyles:"love.style",communicationStyles:"communication.style",sexualOrientations:"sexual.orientation",religions:"religion"}[a]}filterMenuTrigger(a){return D(P(P(D(P({},this.profileFieldMenus.get(this.profileFieldIds[a]??"")?.trigger),{label:void 0}),a==="horoscopes"?{icon:"brightness_5",palette:"gold"}:{}),a==="traitLabels"?{icon:"stars",palette:"pink"}:{}),{layout:"field",ariaLabel:this.filterMenuTitle(a)})}filterMenuSearchable(a){return a==="languages"||a==="interests"||a==="values"}filterMenuModel(a){let t=this.menuModels.get(a);if(t?.selected===this.filterDraft[a])return t.model;let e=this.profileFieldMenus.get(this.profileFieldIds[a]??""),i=e?.model?.groups??[{id:`game-filter-${a}`,label:this.filterMenuTitle(a),items:e?.items??[]}];if(a==="horoscopes"?i=[{id:"horoscopes",items:Object.entries(ot.profileHoroscopeMetaBySign).map(([l,k])=>D(P({id:l,value:l},k),{iconKind:"text",surface:"tinted"}))}]:a==="traitLabels"&&(i=[{id:"traits",items:ot.personalityTraitCatalog.map(l=>({id:l.id,value:l.label,label:l.labelKey,icon:l.icon,surface:"tinted",palette:jt("trait",l.label).menuPalette}))}]),a==="languages"){let l=i.flatMap(k=>k.items??[]);i=[{id:"languages-a-h",label:"A\u2013H"},{id:"languages-i-z",label:"I\u2013Z"}].map((k,z)=>D(P({},k),{icon:"language",palette:e?.trigger?.palette,items:l.filter(I=>`${I.value}`.toLowerCase()<"i"==(z===0)).sort((I,ft)=>`${I.value}`.localeCompare(`${ft.value}`))}))}let d=new Set(this.filterDraft[a].map(l=>l.trim().toLowerCase())),u=new Set,b=l=>{let k=`${l.value??l.id}`,z=k.trim().toLowerCase();u.add(z);let I=d.has(z);return{label:l.label,icon:l.icon,iconKind:l.iconKind,palette:l.palette,surface:l.surface,togglePalette:l.togglePalette,id:`game-filter-${a}-${l.id}`,value:k,kind:"checkbox",checked:I,active:I,removable:I,disabled:!1,closeOnSelect:!1,context:{kind:a,value:k}}},T=i.map(l=>D(P({},l),{headerActions:void 0,items:(l.items??[]).map(b)}));for(let l of this.filterDraft[a])u.has(l.trim().toLowerCase())||T[0].items.push(b({id:l,value:l,label:l}));let V={layout:"tabs",maxSelected:null,groups:T,summary:{emptyLabel:"any",maxLabels:2,counter:"overflow"}};return this.menuModels.set(a,{selected:this.filterDraft[a],model:V}),V}onGameFilterMenuSelect(a){let t=a.context;if(!t)return;if(t.kind==="apply"){this.apply();return}let e=`${a.value??t.value}`.trim();if(e){if(a.action==="remove"){this.removeFilterMenuValue(t.kind,e,a.sourceEvent);return}this.toggleGameFilterMenuValue(t.kind,e)}}requestClose(a){a?.stopPropagation(),!this.saving&&this.closed.emit(null)}apply(){this.saving||this.preparing()||this.closed.emit(Yt(this.filterDraft))}toggleGameFilterMenuValue(a,t){this.filterDraft[a]=this.toggleArraySelection(this.filterDraft[a],t)}removeFilterMenuValue(a,t,e){e?.stopPropagation(),this.filterDraft[a]=this.filterDraft[a].filter(i=>i.trim().toLowerCase()!==t.trim().toLowerCase())}onAgeMinChange(a){this.filterDraft.ageMin=Number(a),this.filterDraft.ageMin>this.filterDraft.ageMax&&(this.filterDraft.ageMax=this.filterDraft.ageMin)}onAgeMaxChange(a){this.filterDraft.ageMax=Number(a),this.filterDraft.ageMax<this.filterDraft.ageMin&&(this.filterDraft.ageMin=this.filterDraft.ageMax)}onHeightMinChange(a){this.filterDraft.heightMinCm=Number(a),this.filterDraft.heightMinCm>this.filterDraft.heightMaxCm&&(this.filterDraft.heightMaxCm=this.filterDraft.heightMinCm)}onHeightMaxChange(a){this.filterDraft.heightMaxCm=Number(a),this.filterDraft.heightMaxCm<this.filterDraft.heightMinCm&&(this.filterDraft.heightMinCm=this.filterDraft.heightMaxCm)}toggleArraySelection(a,t){let e=t.trim().toLowerCase();return a.some(i=>i.trim().toLowerCase()===e)?a.filter(i=>i.trim().toLowerCase()!==e):[...a,t]}static \u0275fac=function(a){return new(a||tt)};static \u0275cmp=Z({type:tt,selectors:[["app-home-game-filter-popup"]],hostBindings:function(a,t){a&1&&M("keydown.escape",function(e){return t.onEscapePressed(e)},vt)},inputs:{context:"context",saving:"saving"},outputs:{closed:"closed"},features:[bt],decls:1,vars:1,consts:[[3,"model","zIndex"],[3,"loading"],[1,"game-filter-body"],[1,"game-filter-layout-columns"],[1,"game-filter-layout-col","game-filter-layout-col-basics"],["data-guide-field","home-filter-basics",1,"game-filter-group","game-filter-group-basics"],[1,"game-filter-group-head"],[1,"game-filter-section-head"],[1,"game-filter-value-badge"],[1,"game-filter-slider-wrap"],[3,"min","max","step"],["matSliderStartThumb","",3,"ngModelChange","ngModel"],["matSliderEndThumb","",3,"ngModelChange","ngModel"],[1,"game-filter-menu-field"],[1,"game-filter-group","game-filter-group-beliefs"],[1,"game-filter-layout-col","game-filter-layout-col-lifestyle"],[1,"game-filter-group","game-filter-group-lifestyle"],[1,"game-filter-layout-col","game-filter-layout-col-relationships"],[1,"game-filter-group","game-filter-group-relationships"],["kind","select",1,"game-filter-menu",3,"itemSelect","title","filterable","trigger","model"]],template:function(a,t){a&1&&E(0,ve,3,3,"app-popup",0),a&2&&O(t.context?0:-1)},dependencies:[At,qt,Vt,Dt,Ut,Ft,ue,de,gt,Bt,Lt],styles:["[_nghost-%COMP%]{display:contents}.game-filter-body[_ngcontent-%COMP%]{position:relative;flex:1 1 auto;min-height:0;width:100%;height:100%;box-sizing:border-box;display:grid;overflow:auto;padding:.4rem;grid-template-columns:1fr;gap:.72rem;align-items:start}.game-filter-layout-columns[_ngcontent-%COMP%]{grid-column:1/-1;display:grid;grid-template-columns:1fr;gap:.72rem;align-items:start}.game-filter-layout-col[_ngcontent-%COMP%]{min-width:0;display:grid;gap:.72rem;align-content:start}.game-filter-group[_ngcontent-%COMP%]{border:1px solid rgba(105,126,156,.24);border-radius:14px;background:linear-gradient(180deg,#f8fbff,#edf4ff);padding:.62rem;display:grid;gap:.48rem}.game-filter-group-head[_ngcontent-%COMP%]{display:flex;align-items:center;justify-content:space-between;padding-bottom:.22rem;border-bottom:1px solid rgba(74,102,139,.22)}.game-filter-group-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{margin:0;font-size:.84rem;letter-spacing:.01em;color:#20385c}.game-filter-group-basics[_ngcontent-%COMP%]{background:linear-gradient(180deg,#f2f7ff,#e8f0fb);border-color:#3a6ca847}.game-filter-group-basics[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]{border-bottom-color:#3a6ca83d}.game-filter-group-basics[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{color:#214772}.game-filter-group-beliefs[_ngcontent-%COMP%]{background:linear-gradient(180deg,#f4f1ff,#ebe6fb);border-color:#6254a347}.game-filter-group-beliefs[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]{border-bottom-color:#6254a33d}.game-filter-group-beliefs[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{color:#4f438b}.game-filter-group-lifestyle[_ngcontent-%COMP%]{background:linear-gradient(180deg,#eef8f3,#e4f2ea);border-color:#317c5247}.game-filter-group-lifestyle[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]{border-bottom-color:#317c523d}.game-filter-group-lifestyle[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{color:#2f6f45}.game-filter-group-relationships[_ngcontent-%COMP%]{background:linear-gradient(180deg,#fff4ee,#f7e9df);border-color:#a05a3347;grid-template-columns:1fr;align-content:start}.game-filter-group-relationships[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]{border-bottom-color:#a05a333d;grid-column:1/-1}.game-filter-group-relationships[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{color:#7d4e33}.game-filter-section-head[_ngcontent-%COMP%]{display:flex;align-items:center;justify-content:space-between;gap:.4rem}.game-filter-section-head[_ngcontent-%COMP%]   h4[_ngcontent-%COMP%]{margin:0;font-size:.82rem;color:#213b5f}.game-filter-value-badge[_ngcontent-%COMP%]{border:1px solid rgba(39,73,114,.22);border-radius:999px;background:linear-gradient(180deg,#f0f6ff,#e6eefb);color:#22436a;font-size:.74rem;font-weight:800;line-height:1;padding:.26rem .5rem;white-space:nowrap}.game-filter-slider-wrap[_ngcontent-%COMP%]{display:grid;gap:.44rem;padding:0 2rem;overflow:hidden}.game-filter-slider-wrap[_ngcontent-%COMP%]   mat-slider[_ngcontent-%COMP%]{width:100%}.game-filter-group-basics[_ngcontent-%COMP%]   .game-filter-slider-wrap[_ngcontent-%COMP%]   mat-slider[_ngcontent-%COMP%]{--%NS%mdc-slider-active-track-color: #2f6fbe;--%NS%mdc-slider-inactive-track-color: rgba(57, 88, 130, .36);--%NS%mdc-slider-handle-color: #1463be;--%NS%mdc-slider-focus-handle-color: #1463be;--%NS%mdc-slider-hover-handle-color: #1463be;--%NS%mdc-slider-pressed-handle-color: #0f5bac}[_nghost-%COMP%]     .game-filter-slider-wrap .mdc-slider__thumb:before, [_nghost-%COMP%]     .game-filter-slider-wrap .mdc-slider__thumb:after{display:none}[_nghost-%COMP%]     .game-filter-group-basics .game-filter-slider-wrap .mdc-slider__track--inactive{background-color:#3958825c!important;opacity:1}[_nghost-%COMP%]     .game-filter-group-basics .game-filter-slider-wrap .mdc-slider__track--active_fill{border-color:#2f6fbe!important}.game-filter-menu-field[_ngcontent-%COMP%]{min-width:0;display:grid;gap:.24rem}.game-filter-menu-field[_ngcontent-%COMP%] > span[_ngcontent-%COMP%]{min-width:0;color:#213b5f;font-size:.76rem;font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.game-filter-menu[_ngcontent-%COMP%]{display:block;width:100%;min-width:0}.game-filter-layout-columns[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr) minmax(0,1fr);align-items:stretch}.game-filter-layout-col[_ngcontent-%COMP%]{align-content:stretch}.game-filter-layout-col-lifestyle[_ngcontent-%COMP%] > .game-filter-group-lifestyle[_ngcontent-%COMP%], .game-filter-layout-col-relationships[_ngcontent-%COMP%] > .game-filter-group-relationships[_ngcontent-%COMP%], .game-filter-layout-col-basics[_ngcontent-%COMP%] > .game-filter-group-beliefs[_ngcontent-%COMP%]{height:100%}.game-filter-layout-col-relationships[_ngcontent-%COMP%] > .game-filter-group-relationships[_ngcontent-%COMP%]{display:flex;flex-direction:column}.game-filter-layout-col-relationships[_ngcontent-%COMP%]   .game-filter-menu-field[_ngcontent-%COMP%]{flex:1 1 0;min-height:0}@media(max-width:760px){.game-filter-body[_ngcontent-%COMP%]{padding:.4rem .4rem calc(.75rem + env(safe-area-inset-bottom));max-height:none;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.game-filter-layout-columns[_ngcontent-%COMP%]{grid-template-columns:1fr;padding-bottom:calc(.5rem + env(safe-area-inset-bottom))}.game-filter-layout-col[_ngcontent-%COMP%]{align-content:start}.game-filter-layout-col-lifestyle[_ngcontent-%COMP%] > .game-filter-group-lifestyle[_ngcontent-%COMP%], .game-filter-layout-col-relationships[_ngcontent-%COMP%] > .game-filter-group-relationships[_ngcontent-%COMP%], .game-filter-layout-col-basics[_ngcontent-%COMP%] > .game-filter-group-beliefs[_ngcontent-%COMP%]{height:auto}.game-filter-layout-col-relationships[_ngcontent-%COMP%] > .game-filter-group-relationships[_ngcontent-%COMP%]{display:grid;flex-direction:initial}.game-filter-layout-col-relationships[_ngcontent-%COMP%]   .game-filter-menu-field[_ngcontent-%COMP%]{flex:initial}}"]})};export{Me as HomeGameFilterPopupComponent};
