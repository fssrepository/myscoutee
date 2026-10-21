import {x,i,o,b as r,g,y}from'./chunk-acedcf54.js';import {aj as m,ai as m$1}from'./chunk-34f32aa2.js';import {eo as sg,aK as O3,f2 as ya,aC as Mt$1,e5 as q3,bS as Yt,c1 as _n,M as Et,f3 as yt$1,bW as Zr,bx as Ue,eY as xo,bR as Ye$1,d4 as gt,p as Ba,er as st$1,cp as be,bD as We$1,F as Di,bJ as Xe,ag as It,f8 as zs}from'./chunk-7d535711.js';import {b0 as We,cp as vt$1,E,cc as s$1,c9 as r$1,ad as OI,S as Km,bn as bD,be as _D,bv as dh,M as Iv,X as LI,c1 as mu,af as Oe,e as AF,bP as jr,cz as wt,ak as PF,ac as OF,bS as kF,a$ as WD,c6 as qD,ah as Oi,c5 as oh,ce as sl,t as Fv,ca as rh,cC as xC,aC as S,bi as aC,l as Dh,bE as gh,cL as zD,as as QD,bH as hh,aS as VI,aU as Vp,a as $D,H as HE,bY as le,c3 as nh,bO as jo,V as LD,cm as vC,aR as VC,aW as Vu,z as Hu,aD as SD,a6 as ND,a9 as Nh,B as BC,aG as Sh,cD as xD,a0 as MD,K as Ih}from'./main-4c5d0d7e.js';var at=["knob"],rt=["valueIndicatorContainer"];function st(a,n){if(a&1&&(Oi(0,"div",2,1)(2,"div",5)(3,"span",6),vC(4),sl()()()),a&2){let e=$D();Fv(4),Nh(e.valueIndicatorText);}}var lt=["trackActive"],ot=["*"];function dt(a,n){if(a&1&&oh(0,"div"),a&2){let e=n.$implicit,t=n.$index,i=$D(3);aC(e===0?"mdc-slider__tick-mark--active":"mdc-slider__tick-mark--inactive"),Ih("transform",i._calcTickMarkTransform(t));}}function ht(a,n){if(a&1&&SD(0,dt,1,4,"div",8,MD),a&2){let e=$D(2);xD(e._tickMarks);}}function ct(a,n){if(a&1&&(Oi(0,"div",6,1),bD(2,ht,2,0),sl()),a&2){let e=$D();Fv(2),_D(e._cachedWidth?2:-1);}}function ut(a,n){if(a&1&&oh(0,"mat-slider-visual-thumb",7),a&2){let e=$D();rh("discrete",e.discrete)("thumbPosition",1)("valueIndicatorText",e.startValueIndicatorText);}}var s=(function(a){return a[a.START=1]="START",a[a.END=2]="END",a})(s||{}),G=(function(a){return a[a.ACTIVE=0]="ACTIVE",a[a.INACTIVE=1]="INACTIVE",a})(G||{}),oe=new S("_MatSlider"),qe=new S("_MatSliderThumb"),je=new S("_MatSliderRangeThumb"),Ze=new S("_MatSliderVisualThumb");var mt=(()=>{class a{_cdr=E(AF);_ngZone=E(Oe);_slider=E(oe);_renderer=E(HE);_listenerCleanups;discrete=false;thumbPosition;valueIndicatorText;_ripple;_knob;_valueIndicatorContainer;_sliderInput;_sliderInputEl;_hoverRippleRef;_focusRippleRef;_activeRippleRef;_isHovered=false;_isActive=false;_isValueIndicatorVisible=false;_hostElement=E(jr).nativeElement;_platform=E(be);constructor(){}ngAfterViewInit(){let e=this._slider._getInput(this.thumbPosition);e&&(this._ripple.radius=24,this._sliderInput=e,this._sliderInputEl=this._sliderInput._hostElement,this._ngZone.runOutsideAngular(()=>{let t=this._sliderInputEl,i=this._renderer;this._listenerCleanups=[i.listen(t,"pointermove",this._onPointerMove),i.listen(t,"pointerdown",this._onDragStart),i.listen(t,"pointerup",this._onDragEnd),i.listen(t,"pointerleave",this._onMouseLeave),i.listen(t,"focus",this._onFocus),i.listen(t,"blur",this._onBlur)];}));}ngOnDestroy(){this._listenerCleanups?.forEach(e=>e());}_onPointerMove=e=>{if(this._sliderInput._isFocused)return;let t=this._hostElement.getBoundingClientRect(),i=this._slider._isCursorOnSliderThumb(e,t);this._isHovered=i,i?this._showHoverRipple():this._hideRipple(this._hoverRippleRef);};_onMouseLeave=()=>{this._isHovered=false,this._hideRipple(this._hoverRippleRef);};_onFocus=()=>{this._hideRipple(this._hoverRippleRef),this._showFocusRipple(),this._hostElement.classList.add("mdc-slider__thumb--focused");};_onBlur=()=>{this._isActive||this._hideRipple(this._focusRippleRef),this._isHovered&&this._showHoverRipple(),this._hostElement.classList.remove("mdc-slider__thumb--focused");};_onDragStart=e=>{e.button===0&&(this._isActive=true,this._showActiveRipple());};_onDragEnd=()=>{this._isActive=false,this._hideRipple(this._activeRippleRef),this._sliderInput._isFocused||this._hideRipple(this._focusRippleRef),this._platform.SAFARI&&this._showHoverRipple();};_showHoverRipple(){this._isShowingRipple(this._hoverRippleRef)||(this._hoverRippleRef=this._showRipple({enterDuration:0,exitDuration:0}),this._hoverRippleRef?.element.classList.add("mat-mdc-slider-hover-ripple"));}_showFocusRipple(){this._isShowingRipple(this._focusRippleRef)||(this._focusRippleRef=this._showRipple({enterDuration:0,exitDuration:0},true),this._focusRippleRef?.element.classList.add("mat-mdc-slider-focus-ripple"));}_showActiveRipple(){this._isShowingRipple(this._activeRippleRef)||(this._activeRippleRef=this._showRipple({enterDuration:225,exitDuration:400}),this._activeRippleRef?.element.classList.add("mat-mdc-slider-active-ripple"));}_isShowingRipple(e){return e?.state===It.FADING_IN||e?.state===It.VISIBLE}_showRipple(e,t){if(!this._slider.disabled&&(this._showValueIndicator(),this._slider._isRange&&this._slider._getThumb(this.thumbPosition===s.START?s.END:s.START)._showValueIndicator(),!(this._slider._globalRippleOptions?.disabled&&!t)))return this._ripple.launch({animation:this._slider._noopAnimations?{enterDuration:0,exitDuration:0}:e,centered:true,persistent:true})}_hideRipple(e){if(e?.fadeOut(),this._isShowingAnyRipple())return;this._slider._isRange||this._hideValueIndicator();let t=this._getSibling();t._isShowingAnyRipple()||(this._hideValueIndicator(),t._hideValueIndicator());}_showValueIndicator(){this._hostElement.classList.add("mdc-slider__thumb--with-indicator");}_hideValueIndicator(){this._hostElement.classList.remove("mdc-slider__thumb--with-indicator");}_getSibling(){return this._slider._getThumb(this.thumbPosition===s.START?s.END:s.START)}_getValueIndicatorContainer(){return this._valueIndicatorContainer?.nativeElement}_getKnob(){return this._knob.nativeElement}_isShowingAnyRipple(){return this._isShowingRipple(this._hoverRippleRef)||this._isShowingRipple(this._focusRippleRef)||this._isShowingRipple(this._activeRippleRef)}static \u0275fac=function(t){return new(t||a)};static \u0275cmp=OI({type:a,selectors:[["mat-slider-visual-thumb"]],viewQuery:function(t,i){if(t&1&&gh(zs,5)(at,5)(rt,5),t&2){let r;zD(r=QD())&&(i._ripple=r.first),zD(r=QD())&&(i._knob=r.first),zD(r=QD())&&(i._valueIndicatorContainer=r.first);}},hostAttrs:[1,"mdc-slider__thumb","mat-mdc-slider-visual-thumb"],inputs:{discrete:"discrete",thumbPosition:"thumbPosition",valueIndicatorText:"valueIndicatorText"},features:[xC([{provide:Ze,useExisting:a}])],decls:4,vars:2,consts:[["knob",""],["valueIndicatorContainer",""],[1,"mdc-slider__value-indicator-container"],[1,"mdc-slider__thumb-knob"],["matRipple","",1,"mat-focus-indicator",3,"matRippleDisabled"],[1,"mdc-slider__value-indicator"],[1,"mdc-slider__value-indicator-text"]],template:function(t,i){t&1&&(bD(0,st,5,1,"div",2),oh(1,"div",3,0)(3,"div",4)),t&2&&(_D(i.discrete?0:-1),Fv(3),rh("matRippleDisabled",true));},dependencies:[zs],styles:[`.mat-mdc-slider-visual-thumb .mat-ripple {
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
`],encapsulation:2,changeDetection:0})}return a})(),Ye=(()=>{class a{_ngZone=E(Oe);_cdr=E(AF);_elementRef=E(jr);_dir=E(gt,{optional:true});_globalRippleOptions=E(Ba,{optional:true});_trackActive;_thumbs;_input;_inputs;get disabled(){return this._disabled}set disabled(e){this._disabled=e;let t=this._getInput(s.END),i=this._getInput(s.START);t&&(t.disabled=this._disabled),i&&(i.disabled=this._disabled);}_disabled=false;get discrete(){return this._discrete}set discrete(e){this._discrete=e,this._updateValueIndicatorUIs();}_discrete=false;get showTickMarks(){return this._showTickMarks}set showTickMarks(e){this._showTickMarks=e,this._hasViewInitialized&&(this._updateTickMarkUI(),this._updateTickMarkTrackUI());}_showTickMarks=false;get min(){return this._min}set min(e){let t=e==null||isNaN(e)?this._min:e;this._min!==t&&this._updateMin(t);}_min=0;color;disableRipple=false;_updateMin(e){let t=this._min;this._min=e,this._isRange?this._updateMinRange({old:t,new:e}):this._updateMinNonRange(e),this._onMinMaxOrStepChange();}_updateMinRange(e){let t=this._getInput(s.END),i=this._getInput(s.START),r=t.value,c=i.value;i.min=e.new,t.min=Math.max(e.new,i.value),i.max=Math.min(t.max,t.value),i._updateWidthInactive(),t._updateWidthInactive(),e.new<e.old?this._onTranslateXChangeBySideEffect(t,i):this._onTranslateXChangeBySideEffect(i,t),r!==t.value&&this._onValueChange(t),c!==i.value&&this._onValueChange(i);}_updateMinNonRange(e){let t=this._getInput(s.END);if(t){let i=t.value;t.min=e,t._updateThumbUIByValue(),this._updateTrackUI(t),i!==t.value&&this._onValueChange(t);}}get max(){return this._max}set max(e){let t=e==null||isNaN(e)?this._max:e;this._max!==t&&this._updateMax(t);}_max=100;_updateMax(e){let t=this._max;this._max=e,this._isRange?this._updateMaxRange({old:t,new:e}):this._updateMaxNonRange(e),this._onMinMaxOrStepChange();}_updateMaxRange(e){let t=this._getInput(s.END),i=this._getInput(s.START),r=t.value,c=i.value;t.max=e.new,i.max=Math.min(e.new,t.value),t.min=i.value,t._updateWidthInactive(),i._updateWidthInactive(),e.new>e.old?this._onTranslateXChangeBySideEffect(i,t):this._onTranslateXChangeBySideEffect(t,i),r!==t.value&&this._onValueChange(t),c!==i.value&&this._onValueChange(i);}_updateMaxNonRange(e){let t=this._getInput(s.END);if(t){let i=t.value;t.max=e,t._updateThumbUIByValue(),this._updateTrackUI(t),i!==t.value&&this._onValueChange(t);}}get step(){return this._step}set step(e){let t=isNaN(e)?this._step:e;this._step!==t&&this._updateStep(t);}_step=1;_updateStep(e){this._step=e,this._isRange?this._updateStepRange():this._updateStepNonRange(),this._onMinMaxOrStepChange();}_updateStepRange(){let e=this._getInput(s.END),t=this._getInput(s.START),i=e.value,r=t.value,c=t.value;e.min=this._min,t.max=this._max,e.step=this._step,t.step=this._step,this._platform.SAFARI&&(e.value=e.value,t.value=t.value),e.min=Math.max(this._min,t.value),t.max=Math.min(this._max,e.value),t._updateWidthInactive(),e._updateWidthInactive(),e.value<c?this._onTranslateXChangeBySideEffect(t,e):this._onTranslateXChangeBySideEffect(e,t),i!==e.value&&this._onValueChange(e),r!==t.value&&this._onValueChange(t);}_updateStepNonRange(){let e=this._getInput(s.END);if(e){let t=e.value;e.step=this._step,this._platform.SAFARI&&(e.value=e.value),e._updateThumbUIByValue(),t!==e.value&&this._onValueChange(e);}}displayWith=e=>`${e}`;_tickMarks;_noopAnimations=st$1();_resizeObserver=null;_cachedWidth;_cachedLeft;_rippleRadius=24;startValueIndicatorText="";endValueIndicatorText="";_endThumbTransform;_startThumbTransform;_isRange=false;_isRtl=wt(()=>this._dir?.valueSignal()==="rtl");_hasViewInitialized=false;_tickMarkTrackWidth=0;_hasAnimation=false;_resizeTimer=null;_platform=E(be);constructor(){E(We$1).load(Di);let e=this._isRtl();PF(()=>{let t=this._isRtl();t!==e&&(e=t,this._isRange?this._onDirChangeRange():this._onDirChangeNonRange(),this._updateTickMarkUI());});}_knobRadius=8;_inputPadding;ngAfterViewInit(){this._platform.isBrowser&&this._updateDimensions();let e=this._getInput(s.END),t=this._getInput(s.START);this._isRange=!!e&&!!t,this._cdr.detectChanges();let i=this._getThumb(s.END);this._rippleRadius=i._ripple.radius,this._inputPadding=this._rippleRadius-this._knobRadius,this._isRange?this._initUIRange(e,t):this._initUINonRange(e),this._updateTrackUI(e),this._updateTickMarkUI(),this._updateTickMarkTrackUI(),this._observeHostResize(),this._cdr.detectChanges();}_initUINonRange(e){e.initProps(),e.initUI(),this._updateValueIndicatorUI(e),this._hasViewInitialized=true,e._updateThumbUIByValue();}_initUIRange(e,t){e.initProps(),e.initUI(),t.initProps(),t.initUI(),e._updateMinMax(),t._updateMinMax(),e._updateStaticStyles(),t._updateStaticStyles(),this._updateValueIndicatorUIs(),this._hasViewInitialized=true,e._updateThumbUIByValue(),t._updateThumbUIByValue();}ngOnDestroy(){this._resizeObserver?.disconnect(),this._resizeObserver=null;}_onDirChangeRange(){let e=this._getInput(s.END),t=this._getInput(s.START);e._setIsLeftThumb(),t._setIsLeftThumb(),e.translateX=e._calcTranslateXByValue(),t.translateX=t._calcTranslateXByValue(),e._updateStaticStyles(),t._updateStaticStyles(),e._updateWidthInactive(),t._updateWidthInactive(),e._updateThumbUIByValue(),t._updateThumbUIByValue();}_onDirChangeNonRange(){this._getInput(s.END)._updateThumbUIByValue();}_observeHostResize(){typeof ResizeObserver>"u"||!ResizeObserver||this._ngZone.runOutsideAngular(()=>{this._resizeObserver=new ResizeObserver(()=>{this._isActive()||(this._resizeTimer&&clearTimeout(this._resizeTimer),this._onResize());}),this._resizeObserver.observe(this._elementRef.nativeElement);});}_isActive(){return this._getThumb(s.START)._isActive||this._getThumb(s.END)._isActive}_getValue(e=s.END){let t=this._getInput(e);return t?t.value:this.min}_skipUpdate(){return !!(this._getInput(s.START)?._skipUIUpdate||this._getInput(s.END)?._skipUIUpdate)}_updateDimensions(){this._cachedWidth=this._elementRef.nativeElement.offsetWidth,this._cachedLeft=this._elementRef.nativeElement.getBoundingClientRect().left;}_setTrackActiveStyles(e){let t=this._trackActive.nativeElement.style;t.left=e.left,t.right=e.right,t.transformOrigin=e.transformOrigin,t.transform=e.transform;}_calcTickMarkTransform(e){let t=e*(this._tickMarkTrackWidth/(this._tickMarks.length-1));return `translateX(${this._isRtl()?this._cachedWidth-6-t:t}px)`}_onTranslateXChange(e){this._hasViewInitialized&&(this._updateThumbUI(e),this._updateTrackUI(e),this._updateOverlappingThumbUI(e));}_onTranslateXChangeBySideEffect(e,t){this._hasViewInitialized&&(e._updateThumbUIByValue(),t._updateThumbUIByValue());}_onValueChange(e){this._hasViewInitialized&&(this._updateValueIndicatorUI(e),this._updateTickMarkUI(),this._cdr.detectChanges());}_onMinMaxOrStepChange(){this._hasViewInitialized&&(this._updateTickMarkUI(),this._updateTickMarkTrackUI(),this._cdr.markForCheck());}_onResize(){if(this._hasViewInitialized){if(this._updateDimensions(),this._isRange){let e=this._getInput(s.END),t=this._getInput(s.START);e._updateThumbUIByValue(),t._updateThumbUIByValue(),e._updateStaticStyles(),t._updateStaticStyles(),e._updateMinMax(),t._updateMinMax(),e._updateWidthInactive(),t._updateWidthInactive();}else {let e=this._getInput(s.END);e&&e._updateThumbUIByValue();}this._updateTickMarkUI(),this._updateTickMarkTrackUI(),this._cdr.detectChanges();}}_thumbsOverlap=false;_areThumbsOverlapping(){let e=this._getInput(s.START),t=this._getInput(s.END);return !e||!t?false:t.translateX-e.translateX<20}_updateOverlappingThumbClassNames(e){let t=e.getSibling(),i=this._getThumb(e.thumbPosition);this._getThumb(t.thumbPosition)._hostElement.classList.remove("mdc-slider__thumb--top"),i._hostElement.classList.toggle("mdc-slider__thumb--top",this._thumbsOverlap);}_updateOverlappingThumbUI(e){!this._isRange||this._skipUpdate()||this._thumbsOverlap!==this._areThumbsOverlapping()&&(this._thumbsOverlap=!this._thumbsOverlap,this._updateOverlappingThumbClassNames(e));}_updateThumbUI(e){if(this._skipUpdate())return;let t=this._getThumb(e.thumbPosition===s.END?s.END:s.START);t._hostElement.style.transform=`translateX(${e.translateX}px)`;}_updateValueIndicatorUI(e){if(this._skipUpdate())return;let t=this.displayWith(e.value);if(this._hasViewInitialized?e._valuetext.set(t):e._hostElement.setAttribute("aria-valuetext",t),this.discrete){e.thumbPosition===s.START?this.startValueIndicatorText=t:this.endValueIndicatorText=t;let i=this._getThumb(e.thumbPosition);t.length<3?i._hostElement.classList.add("mdc-slider__thumb--short-value"):i._hostElement.classList.remove("mdc-slider__thumb--short-value");}}_updateValueIndicatorUIs(){let e=this._getInput(s.END),t=this._getInput(s.START);e&&this._updateValueIndicatorUI(e),t&&this._updateValueIndicatorUI(t);}_updateTickMarkTrackUI(){if(!this.showTickMarks||this._skipUpdate())return;let e=this._step&&this._step>0?this._step:1,i=(Math.floor(this.max/e)*e-this.min)/(this.max-this.min);this._tickMarkTrackWidth=(this._cachedWidth-6)*i;}_updateTrackUI(e){this._skipUpdate()||(this._isRange?this._updateTrackUIRange(e):this._updateTrackUINonRange(e));}_updateTrackUIRange(e){let t=e.getSibling();if(!t||!this._cachedWidth)return;let i=Math.abs(t.translateX-e.translateX)/this._cachedWidth;e._isLeftThumb&&this._cachedWidth?this._setTrackActiveStyles({left:"auto",right:`${this._cachedWidth-t.translateX}px`,transformOrigin:"right",transform:`scaleX(${i})`}):this._setTrackActiveStyles({left:`${t.translateX}px`,right:"auto",transformOrigin:"left",transform:`scaleX(${i})`});}_updateTrackUINonRange(e){this._isRtl()?this._setTrackActiveStyles({left:"auto",right:"0px",transformOrigin:"right",transform:`scaleX(${1-e.fillPercentage})`}):this._setTrackActiveStyles({left:"0px",right:"auto",transformOrigin:"left",transform:`scaleX(${e.fillPercentage})`});}_updateTickMarkUI(){if(!this.showTickMarks||this.step===void 0||this.min===void 0||this.max===void 0)return;let e=this.step>0?this.step:1;this._isRange?this._updateTickMarkUIRange(e):this._updateTickMarkUINonRange(e);}_updateTickMarkUINonRange(e){let t=this._getValue(),i=Math.max(Math.round((t-this.min)/e),0)+1,r=Math.max(Math.round((this.max-t)/e),0)-1;this._isRtl()?i++:r++,this._tickMarks=Array(i).fill(G.ACTIVE).concat(Array(r).fill(G.INACTIVE));}_updateTickMarkUIRange(e){let t=this._getValue(),i=this._getValue(s.START),r=Math.max(Math.round((i-this.min)/e),0),c=Math.max(Math.round((t-i)/e)+1,0),f=Math.max(Math.round((this.max-t)/e),0);this._tickMarks=Array(r).fill(G.INACTIVE).concat(Array(c).fill(G.ACTIVE),Array(f).fill(G.INACTIVE));}_getInput(e){if(e===s.END&&this._input)return this._input;if(this._inputs?.length)return e===s.START?this._inputs.first:this._inputs.last}_getThumb(e){return e===s.END?this._thumbs?.last:this._thumbs?.first}_setTransition(e){this._hasAnimation=!this._platform.IOS&&e&&!this._noopAnimations,this._elementRef.nativeElement.classList.toggle("mat-mdc-slider-with-animation",this._hasAnimation);}_isCursorOnSliderThumb(e,t){let i=t.width/2,r=t.x+i,c=t.y+i,f=e.clientX-r,R=e.clientY-c;return Math.pow(f,2)+Math.pow(R,2)<Math.pow(i,2)}static \u0275fac=function(t){return new(t||a)};static \u0275cmp=OI({type:a,selectors:[["mat-slider"]],contentQueries:function(t,i,r){if(t&1&&hh(r,qe,5)(r,je,4),t&2){let c;zD(c=QD())&&(i._input=c.first),zD(c=QD())&&(i._inputs=c);}},viewQuery:function(t,i){if(t&1&&gh(lt,5)(Ze,5),t&2){let r;zD(r=QD())&&(i._trackActive=r.first),zD(r=QD())&&(i._thumbs=r);}},hostAttrs:[1,"mat-mdc-slider","mdc-slider"],hostVars:12,hostBindings:function(t,i){t&2&&(aC("mat-"+(i.color||"primary")),Dh("mdc-slider--range",i._isRange)("mdc-slider--disabled",i.disabled)("mdc-slider--discrete",i.discrete)("mdc-slider--tick-marks",i.showTickMarks)("_mat-animation-noopable",i._noopAnimations));},inputs:{disabled:[2,"disabled","disabled",kF],discrete:[2,"discrete","discrete",kF],showTickMarks:[2,"showTickMarks","showTickMarks",kF],min:[2,"min","min",OF],color:"color",disableRipple:[2,"disableRipple","disableRipple",kF],max:[2,"max","max",OF],step:[2,"step","step",OF],displayWith:"displayWith"},exportAs:["matSlider"],features:[xC([{provide:oe,useExisting:a}])],ngContentSelectors:ot,decls:9,vars:5,consts:[["trackActive",""],["tickMarkContainer",""],[1,"mdc-slider__track"],[1,"mdc-slider__track--inactive"],[1,"mdc-slider__track--active"],[1,"mdc-slider__track--active_fill"],[1,"mdc-slider__tick-marks"],[3,"discrete","thumbPosition","valueIndicatorText"],[3,"class","transform"]],template:function(t,i){t&1&&(WD(),qD(0),Oi(1,"div",2),oh(2,"div",3),Oi(3,"div",4),oh(4,"div",5,0),sl(),bD(6,ct,3,1,"div",6),sl(),bD(7,ut,1,3,"mat-slider-visual-thumb",7),oh(8,"mat-slider-visual-thumb",7)),t&2&&(Fv(6),_D(i.showTickMarks?6:-1),Fv(),_D(i._isRange?7:-1),Fv(),rh("discrete",i.discrete)("thumbPosition",2)("valueIndicatorText",i.endValueIndicatorText));},dependencies:[mt],styles:[`.mdc-slider__track {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 100%;
  pointer-events: none;
  height: var(--mat-slider-inactive-track-height, 4px);
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
  border-radius: var(--mat-slider-active-track-shape, var(--mat-sys-corner-full));
  height: var(--mat-slider-active-track-height, 4px);
  top: calc((var(--mat-slider-inactive-track-height, 4px) - var(--mat-slider-active-track-height, 4px)) / 2);
}

.mdc-slider__track--active_fill {
  border-top-style: solid;
  box-sizing: border-box;
  height: 100%;
  width: 100%;
  position: relative;
  transform-origin: left;
  transition: transform 80ms ease;
  border-color: var(--mat-slider-active-track-color, var(--mat-sys-primary));
  border-top-width: var(--mat-slider-active-track-height, 4px);
}
.mdc-slider--disabled .mdc-slider__track--active_fill {
  border-color: var(--mat-slider-disabled-active-track-color, var(--mat-sys-on-surface));
}
[dir=rtl] .mdc-slider__track--active_fill {
  -webkit-transform-origin: right;
  transform-origin: right;
}

.mdc-slider__track--inactive {
  left: 0;
  top: 0;
  opacity: 0.24;
  background-color: var(--mat-slider-inactive-track-color, var(--mat-sys-surface-variant));
  height: var(--mat-slider-inactive-track-height, 4px);
  border-radius: var(--mat-slider-inactive-track-shape, var(--mat-sys-corner-full));
}
.mdc-slider--disabled .mdc-slider__track--inactive {
  background-color: var(--mat-slider-disabled-inactive-track-color, var(--mat-sys-on-surface));
  opacity: 0.24;
}
.mdc-slider__track--inactive::before {
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
  .mdc-slider__track--inactive::before {
    border-color: CanvasText;
  }
}

.mdc-slider__value-indicator-container {
  bottom: 44px;
  left: 50%;
  pointer-events: none;
  position: absolute;
  transform: var(--mat-slider-value-indicator-container-transform, translateX(-50%) rotate(-45deg));
}
.mdc-slider__thumb--with-indicator .mdc-slider__value-indicator-container {
  pointer-events: auto;
}

.mdc-slider__value-indicator {
  display: flex;
  align-items: center;
  transform: scale(0);
  transform-origin: var(--mat-slider-value-indicator-transform-origin, 0 28px);
  transition: transform 100ms cubic-bezier(0.4, 0, 1, 1);
  word-break: normal;
  background-color: var(--mat-slider-label-container-color, var(--mat-sys-primary));
  color: var(--mat-slider-label-label-text-color, var(--mat-sys-on-primary));
  width: var(--mat-slider-value-indicator-width, 28px);
  height: var(--mat-slider-value-indicator-height, 28px);
  padding: var(--mat-slider-value-indicator-padding, 0);
  opacity: var(--mat-slider-value-indicator-opacity, 1);
  border-radius: var(--mat-slider-value-indicator-border-radius, 50% 50% 50% 0);
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
  display: var(--mat-slider-value-indicator-caret-display, none);
  border-top-color: var(--mat-slider-label-container-color, var(--mat-sys-primary));
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
  width: var(--mat-slider-value-indicator-width, 28px);
  transform: var(--mat-slider-value-indicator-text-transform, rotate(45deg));
  font-family: var(--mat-slider-label-label-text-font, var(--mat-sys-label-medium-font));
  font-size: var(--mat-slider-label-label-text-size, var(--mat-sys-label-medium-size));
  font-weight: var(--mat-slider-label-label-text-weight, var(--mat-sys-label-medium-weight));
  line-height: var(--mat-slider-label-label-text-line-height, var(--mat-sys-label-medium-line-height));
  letter-spacing: var(--mat-slider-label-label-text-tracking, var(--mat-sys-label-medium-tracking));
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
  width: var(--mat-slider-handle-width, 20px);
  height: var(--mat-slider-handle-height, 20px);
  border-width: calc(var(--mat-slider-handle-height, 20px) / 2) calc(var(--mat-slider-handle-width, 20px) / 2);
  box-shadow: var(--mat-slider-handle-elevation, var(--mat-sys-level1));
  background-color: var(--mat-slider-handle-color, var(--mat-sys-primary));
  border-color: var(--mat-slider-handle-color, var(--mat-sys-primary));
  border-radius: var(--mat-slider-handle-shape, var(--mat-sys-corner-full));
}
.mdc-slider__thumb:hover .mdc-slider__thumb-knob {
  background-color: var(--mat-slider-hover-handle-color, var(--mat-sys-primary));
  border-color: var(--mat-slider-hover-handle-color, var(--mat-sys-primary));
}
.mdc-slider__thumb--focused .mdc-slider__thumb-knob {
  background-color: var(--mat-slider-focus-handle-color, var(--mat-sys-primary));
  border-color: var(--mat-slider-focus-handle-color, var(--mat-sys-primary));
}
.mdc-slider--disabled .mdc-slider__thumb-knob {
  background-color: var(--mat-slider-disabled-handle-color, var(--mat-sys-on-surface));
  border-color: var(--mat-slider-disabled-handle-color, var(--mat-sys-on-surface));
}
.mdc-slider__thumb--top .mdc-slider__thumb-knob, .mdc-slider__thumb--top.mdc-slider__thumb:hover .mdc-slider__thumb-knob, .mdc-slider__thumb--top.mdc-slider__thumb--focused .mdc-slider__thumb-knob {
  border: solid 1px #fff;
  box-sizing: content-box;
  border-color: var(--mat-slider-with-overlap-handle-outline-color, var(--mat-sys-on-primary));
  border-width: var(--mat-slider-with-overlap-handle-outline-width, 1px);
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
  width: var(--mat-slider-with-tick-marks-container-size, 2px);
  height: var(--mat-slider-with-tick-marks-container-size, 2px);
  border-radius: var(--mat-slider-with-tick-marks-container-shape, var(--mat-sys-corner-full));
}

.mdc-slider__tick-mark--inactive {
  opacity: var(--mat-slider-with-tick-marks-inactive-container-opacity, 0.38);
  background-color: var(--mat-slider-with-tick-marks-inactive-container-color, var(--mat-sys-on-surface-variant));
}
.mdc-slider--disabled .mdc-slider__tick-mark--inactive {
  opacity: var(--mat-slider-with-tick-marks-inactive-container-opacity, 0.38);
  background-color: var(--mat-slider-with-tick-marks-disabled-container-color, var(--mat-sys-on-surface));
}

.mdc-slider__tick-mark--active {
  opacity: var(--mat-slider-with-tick-marks-active-container-opacity, 0.38);
  background-color: var(--mat-slider-with-tick-marks-active-container-color, var(--mat-sys-on-primary));
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
  background-color: var(--mat-slider-ripple-color, var(--mat-sys-primary));
}
.mat-mdc-slider .mat-ripple .mat-mdc-slider-hover-ripple {
  background-color: var(--mat-slider-hover-state-layer-color, color-mix(in srgb, var(--mat-sys-primary) 5%, transparent));
}
.mat-mdc-slider .mat-ripple .mat-mdc-slider-focus-ripple,
.mat-mdc-slider .mat-ripple .mat-mdc-slider-active-ripple {
  background-color: var(--mat-slider-focus-state-layer-color, color-mix(in srgb, var(--mat-sys-primary) 20%, transparent));
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
`],encapsulation:2,changeDetection:0})}return a})();var pt={provide:Xe,useExisting:jo(()=>Je),multi:true},_t={provide:Xe,useExisting:jo(()=>de),multi:true},Je=(()=>{class a{_ngZone=E(Oe);_elementRef=E(jr);_cdr=E(AF);_slider=E(oe);_platform=E(be);_listenerCleanups;get value(){return OF(this._hostElement.value,0)}set value(e){e===null&&(e=this._getDefaultValue()),e=isNaN(e)?0:e;let t=e+"";if(!this._hasSetInitialValue){this._initialValue=t;return}this._isActive||this._setValue(t);}_setValue(e){this._hostElement.value=e,this._updateThumbUIByValue(),this._slider._onValueChange(this),this._cdr.detectChanges(),this._slider._cdr.markForCheck();}valueChange=new We;dragStart=new We;dragEnd=new We;get translateX(){return this._slider.min>=this._slider.max?(this._translateX=this._tickMarkOffset,this._translateX):(this._translateX===void 0&&(this._translateX=this._calcTranslateXByValue()),this._translateX)}set translateX(e){this._translateX=e;}_translateX;thumbPosition=s.END;get min(){return OF(this._hostElement.min,0)}set min(e){this._hostElement.min=e+"",this._cdr.detectChanges();}get max(){return OF(this._hostElement.max,0)}set max(e){this._hostElement.max=e+"",this._cdr.detectChanges();}get step(){return OF(this._hostElement.step,0)}set step(e){this._hostElement.step=e+"",this._cdr.detectChanges();}get disabled(){return kF(this._hostElement.disabled)}set disabled(e){this._hostElement.disabled=e,this._cdr.detectChanges(),this._slider.disabled!==this.disabled&&(this._slider.disabled=this.disabled);}get percentage(){return this._slider.min>=this._slider.max?this._slider._isRtl()?1:0:(this.value-this._slider.min)/(this._slider.max-this._slider.min)}get fillPercentage(){return this._slider._cachedWidth?this._translateX===0?0:this.translateX/this._slider._cachedWidth:this._slider._isRtl()?1:0}_hostElement=this._elementRef.nativeElement;_valuetext=vt$1("");_knobRadius=8;_tickMarkOffset=3;_isActive=false;_isFocused=false;_setIsFocused(e){this._isFocused=e;}_hasSetInitialValue=false;_initialValue;_formControl;_destroyed=new le;_skipUIUpdate=false;_onChangeFn;_onTouchedFn=()=>{};_isControlInitialized=false;constructor(){let e=E(HE);this._ngZone.runOutsideAngular(()=>{this._listenerCleanups=[e.listen(this._hostElement,"pointerdown",this._onPointerDown.bind(this)),e.listen(this._hostElement,"pointermove",this._onPointerMove.bind(this)),e.listen(this._hostElement,"pointerup",this._onPointerUp.bind(this))];});}ngOnDestroy(){this._listenerCleanups.forEach(e=>e()),this._destroyed.next(),this._destroyed.complete(),this.dragStart.complete(),this.dragEnd.complete();}initProps(){this._updateWidthInactive(),this.disabled!==this._slider.disabled&&(this._slider.disabled=true),this.step=this._slider.step,this.min=this._slider.min,this.max=this._slider.max,this._initValue();}initUI(){this._updateThumbUIByValue();}_initValue(){this._hasSetInitialValue=true,this._initialValue===void 0?this.value=this._getDefaultValue():(this._hostElement.value=this._initialValue,this._updateThumbUIByValue(),this._slider._onValueChange(this),this._cdr.detectChanges());}_getDefaultValue(){return this.min}_onBlur(){this._setIsFocused(false),this._onTouchedFn();}_onFocus(){this._slider._setTransition(false),this._slider._updateTrackUI(this),this._setIsFocused(true);}_onChange(){this.valueChange.emit(this.value),this._isActive&&this._updateThumbUIByValue({withAnimation:true});}_onInput(){this._onChangeFn?.(this.value),(this._slider.step||!this._isActive)&&this._updateThumbUIByValue({withAnimation:true}),this._slider._onValueChange(this);}_onNgControlValueChange(){(!this._isActive||!this._isFocused)&&(this._slider._onValueChange(this),this._updateThumbUIByValue()),this._slider.disabled=this._formControl.disabled;}_onPointerDown(e){if(!(this.disabled||e.button!==0)){if(this._platform.IOS){let t=this._slider._isCursorOnSliderThumb(e,this._slider._getThumb(this.thumbPosition)._hostElement.getBoundingClientRect());this._isActive=t,this._updateWidthActive(),this._slider._updateDimensions();return}this._isActive=true,this._setIsFocused(true),this._updateWidthActive(),this._slider._updateDimensions(),this._slider.step||this._updateThumbUIByPointerEvent(e,{withAnimation:true}),this.disabled||(this._handleValueCorrection(e),this.dragStart.emit({source:this,parent:this._slider,value:this.value}));}}_handleValueCorrection(e){this._skipUIUpdate=true,setTimeout(()=>{this._skipUIUpdate=false,this._fixValue(e);},0);}_fixValue(e){let t=e.clientX-this._slider._cachedLeft,i=this._slider._cachedWidth,r=this._slider.step===0?1:this._slider.step,c=Math.floor((this._slider.max-this._slider.min)/r),f=this._slider._isRtl()?1-t/i:t/i,$=Math.round(f*c)/c*(this._slider.max-this._slider.min)+this._slider.min,o=Math.round($/r)*r,b=this.value;if(o===b){this._slider._onValueChange(this),this._slider.step>0?this._updateThumbUIByValue():this._updateThumbUIByPointerEvent(e,{withAnimation:this._slider._hasAnimation});return}this.value=o,this.valueChange.emit(this.value),this._onChangeFn?.(this.value),this._slider._onValueChange(this),this._slider.step>0?this._updateThumbUIByValue():this._updateThumbUIByPointerEvent(e,{withAnimation:this._slider._hasAnimation});}_onPointerMove(e){!this._slider.step&&this._isActive&&this._updateThumbUIByPointerEvent(e);}_onPointerUp(){this._isActive&&(this._isActive=false,this._platform.SAFARI&&this._setIsFocused(false),this.dragEnd.emit({source:this,parent:this._slider,value:this.value}),setTimeout(()=>this._updateWidthInactive(),this._platform.IOS?10:0));}_clamp(e){let t=this._tickMarkOffset,i=this._slider._cachedWidth-this._tickMarkOffset;return Math.max(Math.min(e,i),t)}_calcTranslateXByValue(){return this._slider._isRtl()?(1-this.percentage)*(this._slider._cachedWidth-this._tickMarkOffset*2)+this._tickMarkOffset:this.percentage*(this._slider._cachedWidth-this._tickMarkOffset*2)+this._tickMarkOffset}_calcTranslateXByPointerEvent(e){return e.clientX-this._slider._cachedLeft}_updateWidthActive(){}_updateWidthInactive(){this._hostElement.style.padding=`0 ${this._slider._inputPadding}px`,this._hostElement.style.width=`calc(100% + ${this._slider._inputPadding-this._tickMarkOffset*2}px)`,this._hostElement.style.left=`-${this._slider._rippleRadius-this._tickMarkOffset}px`;}_updateThumbUIByValue(e){this.translateX=this._clamp(this._calcTranslateXByValue()),this._updateThumbUI(e);}_updateThumbUIByPointerEvent(e,t){this.translateX=this._clamp(this._calcTranslateXByPointerEvent(e)),this._updateThumbUI(t);}_updateThumbUI(e){this._slider._setTransition(!!e?.withAnimation),this._slider._onTranslateXChange(this);}writeValue(e){(this._isControlInitialized||e!==null)&&(this.value=e);}registerOnChange(e){this._onChangeFn=e,this._isControlInitialized=true;}registerOnTouched(e){this._onTouchedFn=e;}setDisabledState(e){this.disabled=e;}focus(){this._hostElement.focus();}blur(){this._hostElement.blur();}static \u0275fac=function(t){return new(t||a)};static \u0275dir=VI({type:a,selectors:[["input","matSliderThumb",""]],hostAttrs:["type","range",1,"mdc-slider__input"],hostVars:1,hostBindings:function(t,i){t&1&&dh("change",function(){return i._onChange()})("input",function(){return i._onInput()})("blur",function(){return i._onBlur()})("focus",function(){return i._onFocus()}),t&2&&nh("aria-valuetext",i._valuetext());},inputs:{value:[2,"value","value",OF]},outputs:{valueChange:"valueChange",dragStart:"dragStart",dragEnd:"dragEnd"},exportAs:["matSliderThumb"],features:[xC([pt,{provide:qe,useExisting:a}])]})}return a})(),de=(()=>{class a extends Je{_cdr=E(AF);getSibling(){return this._sibling||(this._sibling=this._slider._getInput(this._isEndThumb?s.START:s.END)),this._sibling}_sibling;getMinPos(){let e=this.getSibling();return !this._isLeftThumb&&e?e.translateX:this._tickMarkOffset}getMaxPos(){let e=this.getSibling();return this._isLeftThumb&&e?e.translateX:this._slider._cachedWidth-this._tickMarkOffset}_setIsLeftThumb(){this._isLeftThumb=this._isEndThumb&&this._slider._isRtl()||!this._isEndThumb&&!this._slider._isRtl();}_isLeftThumb=false;_isEndThumb=false;constructor(){super(),this._isEndThumb=this._hostElement.hasAttribute("matSliderEndThumb"),this._setIsLeftThumb(),this.thumbPosition=this._isEndThumb?s.END:s.START;}_getDefaultValue(){return this._isEndThumb&&this._slider._isRange?this.max:this.min}_onInput(){super._onInput(),this._updateSibling(),this._isActive||this._updateWidthInactive();}_onNgControlValueChange(){super._onNgControlValueChange(),this.getSibling()?._updateMinMax();}_onPointerDown(e){this.disabled||e.button!==0||(this._sibling&&(this._sibling._updateWidthActive(),this._sibling._hostElement.classList.add("mat-mdc-slider-input-no-pointer-events")),super._onPointerDown(e));}_onPointerUp(){super._onPointerUp(),this._sibling&&setTimeout(()=>{this._sibling._updateWidthInactive(),this._sibling._hostElement.classList.remove("mat-mdc-slider-input-no-pointer-events");});}_onPointerMove(e){super._onPointerMove(e),!this._slider.step&&this._isActive&&this._updateSibling();}_fixValue(e){super._fixValue(e),this._sibling?._updateMinMax();}_clamp(e){return Math.max(Math.min(e,this.getMaxPos()),this.getMinPos())}_updateMinMax(){let e=this.getSibling();e&&(this._isEndThumb?(this.min=Math.max(this._slider.min,e.value),this.max=this._slider.max):(this.min=this._slider.min,this.max=Math.min(this._slider.max,e.value)));}_updateWidthActive(){let e=this._slider._rippleRadius*2-this._slider._inputPadding*2,t=this._slider._cachedWidth+this._slider._inputPadding-e-this._tickMarkOffset*2,i=this._slider.min<this._slider.max?(this.max-this.min)/(this._slider.max-this._slider.min):1,r=t*i+e;this._hostElement.style.width=`${r}px`,this._hostElement.style.padding=`0 ${this._slider._inputPadding}px`;}_updateWidthInactive(){let e=this.getSibling();if(!e)return;let t=this._slider._cachedWidth-this._tickMarkOffset*2,i=this._isEndThumb?this.value-(this.value-e.value)/2:this.value+(e.value-this.value)/2,r=this._isEndThumb?(this.max-i)/(this._slider.max-this._slider.min):(i-this.min)/(this._slider.max-this._slider.min),c=this._slider.min<this._slider.max?r:1,f=this._slider._rippleRadius;c===1?f=48:c===0&&(f=0);let R=t*c+f;this._hostElement.style.width=`${R}px`,this._hostElement.style.padding="0px",this._isLeftThumb?(this._hostElement.style.left=`-${this._slider._rippleRadius-this._tickMarkOffset}px`,this._hostElement.style.right="auto"):(this._hostElement.style.left="auto",this._hostElement.style.right=`-${this._slider._rippleRadius-this._tickMarkOffset}px`);}_updateStaticStyles(){this._hostElement.classList.toggle("mat-slider__right-input",!this._isLeftThumb);}_updateSibling(){let e=this.getSibling();e&&(e._updateMinMax(),this._isActive?e._updateWidthActive():e._updateWidthInactive());}writeValue(e){(this._isControlInitialized||e!==null)&&(this.value=e,this._updateWidthInactive(),this._updateSibling());}_setValue(e){super._setValue(e),this._updateWidthInactive(),this._updateSibling();}static \u0275fac=function(t){return new(t||a)};static \u0275dir=VI({type:a,selectors:[["input","matSliderStartThumb",""],["input","matSliderEndThumb",""]],exportAs:["matSliderRangeThumb"],features:[xC([_t,{provide:je,useExisting:a}]),Vp]})}return a})(),et=(()=>{class a{static \u0275fac=function(t){return new(t||a)};static \u0275mod=LI({type:a});static \u0275inj=mu({imports:[xo,Ye$1]})}return a})();function ft(a,n){a&1&&oh(0,"app-form-flow",1),a&2&&rh("loading",true);}function vt(a,n){if(a&1){let e=LD();Oi(0,"label",13)(1,"span"),vC(2),VC(3,"i18n"),sl(),Oi(4,"app-menu",19),dh("itemSelect",function(i){Vu(e);let r=$D(3);return Hu(r.onGameFilterMenuSelect(i))}),sl()();}if(a&2){let e=n.$implicit,t=$D(3);Fv(2),Nh(BC(3,6,t.filterMenuTitle(e))),Fv(2),rh("title",t.filterMenuTitle(e))("filterable",t.filterMenuSearchable(e))("trigger",t.filterMenuTrigger(e))("model",t.filterMenuModel(e)),nh("data-guide-control","home-filter-"+e);}}function bt(a,n){if(a&1){let e=LD();Oi(0,"label",13)(1,"span"),vC(2),VC(3,"i18n"),sl(),Oi(4,"app-menu",19),dh("itemSelect",function(i){Vu(e);let r=$D(3);return Hu(r.onGameFilterMenuSelect(i))}),sl()();}if(a&2){let e=n.$implicit,t=$D(3);Fv(2),Nh(BC(3,6,t.filterMenuTitle(e))),Fv(2),rh("title",t.filterMenuTitle(e))("filterable",t.filterMenuSearchable(e))("trigger",t.filterMenuTrigger(e))("model",t.filterMenuModel(e)),nh("data-guide-control","home-filter-"+e);}}function Mt(a,n){if(a&1){let e=LD();Oi(0,"label",13)(1,"span"),vC(2),VC(3,"i18n"),sl(),Oi(4,"app-menu",19),dh("itemSelect",function(i){Vu(e);let r=$D(3);return Hu(r.onGameFilterMenuSelect(i))}),sl()();}if(a&2){let e=n.$implicit,t=$D(3);Fv(2),Nh(BC(3,6,t.filterMenuTitle(e))),Fv(2),rh("title",t.filterMenuTitle(e))("filterable",t.filterMenuSearchable(e))("trigger",t.filterMenuTrigger(e))("model",t.filterMenuModel(e)),nh("data-guide-control","home-filter-"+e);}}function xt(a,n){if(a&1){let e=LD();Oi(0,"label",13)(1,"span"),vC(2),VC(3,"i18n"),sl(),Oi(4,"app-menu",19),dh("itemSelect",function(i){Vu(e);let r=$D(3);return Hu(r.onGameFilterMenuSelect(i))}),sl()();}if(a&2){let e=n.$implicit,t=$D(3);Fv(2),Nh(BC(3,6,t.filterMenuTitle(e))),Fv(2),rh("title",t.filterMenuTitle(e))("filterable",t.filterMenuSearchable(e))("trigger",t.filterMenuTrigger(e))("model",t.filterMenuModel(e)),nh("data-guide-control","home-filter-"+e);}}function Ct(a,n){if(a&1){let e=LD();Oi(0,"div",2)(1,"div",3)(2,"div",4)(3,"section",5)(4,"div",6)(5,"h3"),vC(6),VC(7,"i18n"),sl()(),Oi(8,"div",7)(9,"h4"),vC(10),VC(11,"i18n"),sl(),Oi(12,"span",8),vC(13),sl()(),Oi(14,"div",9)(15,"mat-slider",10)(16,"input",11),dh("ngModelChange",function(i){Vu(e);let r=$D(2);return Hu(r.onAgeMinChange(i))}),sl(),Oi(17,"input",12),dh("ngModelChange",function(i){Vu(e);let r=$D(2);return Hu(r.onAgeMaxChange(i))}),sl()()(),Oi(18,"div",7)(19,"h4"),vC(20),VC(21,"i18n"),sl(),Oi(22,"span",8),vC(23),sl()(),Oi(24,"div",9)(25,"mat-slider",10)(26,"input",11),dh("ngModelChange",function(i){Vu(e);let r=$D(2);return Hu(r.onHeightMinChange(i))}),sl(),Oi(27,"input",12),dh("ngModelChange",function(i){Vu(e);let r=$D(2);return Hu(r.onHeightMaxChange(i))}),sl()()(),SD(28,vt,5,8,"label",13,ND),sl(),Oi(30,"section",14)(31,"div",6)(32,"h3"),vC(33),VC(34,"i18n"),sl()(),SD(35,bt,5,8,"label",13,ND),sl()(),Oi(37,"div",15)(38,"section",16)(39,"div",6)(40,"h3"),vC(41),VC(42,"i18n"),sl()(),SD(43,Mt,5,8,"label",13,ND),sl()(),Oi(45,"div",17)(46,"section",18)(47,"div",6)(48,"h3"),vC(49),VC(50,"i18n"),sl()(),SD(51,xt,5,8,"label",13,ND),sl()()()();}if(a&2){let e=$D(2);Fv(6),Nh(BC(7,20,"basics")),Fv(4),Nh(BC(11,22,"age.range")),Fv(3),Sh("",e.filterDraft.ageMin," - ",e.filterDraft.ageMax),Fv(2),rh("min",e.minAgeBound)("max",e.maxAgeBound)("step",1),Fv(),rh("ngModel",e.filterDraft.ageMin),Fv(),rh("ngModel",e.filterDraft.ageMax),Fv(3),Nh(BC(21,24,"height.range.cm")),Fv(3),Sh("",e.filterDraft.heightMinCm," - ",e.filterDraft.heightMaxCm),Fv(2),rh("min",e.minHeightBoundCm)("max",e.maxHeightBoundCm)("step",1),Fv(),rh("ngModel",e.filterDraft.heightMinCm),Fv(),rh("ngModel",e.filterDraft.heightMaxCm),Fv(),xD(e.basicsFilterMenuKinds),Fv(5),Nh(BC(34,26,"beliefs")),Fv(2),xD(e.beliefsFilterMenuKinds),Fv(6),Nh(BC(42,28,"lifestyle")),Fv(2),xD(e.lifestyleFilterMenuKinds),Fv(6),Nh(BC(50,30,"relationships")),Fv(2),xD(e.relationshipFilterMenuKinds);}}function yt(a,n){if(a&1&&(Oi(0,"app-popup",0),bD(1,ft,1,1,"app-form-flow",1)(2,Ct,53,32,"div",2),sl()),a&2){let e=$D();rh("model",e.gameFilterPopupModel())("zIndex",e.gameFilterPopupZIndex()),Fv(),_D(e.preparing()?1:2);}}var tt=class a{context=null;saving=false;closed=new We;filterDraft;preparing=vt$1(true);cancelPreparation=null;explanationGuide=E(sg);unregisterExplanationContext=null;cachedProfileFieldMenus=null;menuModels=new Map;get profileFieldMenus(){return this.cachedProfileFieldMenus??=new Map(m.convert(null,{imageEditor:"external",showHeader:false,showSave:false}).steps.flatMap(n=>n.controls??[]).filter(n=>n.kind==="menu").map(n=>[n.id,n.config]))}ngAfterViewInit(){this.cancelPreparation=O3(()=>{this.preparing.set(false),this.cancelPreparation=null;});}ngOnDestroy(){this.cancelPreparation?.(),this.unregisterExplanationContext?.(),this.unregisterExplanationContext=null;}profileFieldIds={interests:"interests",values:"values",physiques:"physique",languages:"languages",genders:"gender",smoking:"smoking",drinking:"drinking",workout:"workout",pets:"pets",familyPlans:"familyPlans",children:"children",loveStyles:"loveStyle",communicationStyles:"communicationStyle",sexualOrientations:"sexualOrientation",religions:"religion"};basicsFilterMenuKinds=["horoscopes","languages"];beliefsFilterMenuKinds=["values","religions"];lifestyleFilterMenuKinds=["interests","physiques","smoking","drinking","workout","pets"];relationshipFilterMenuKinds=["genders","traitLabels","familyPlans","children","loveStyles","communicationStyles","sexualOrientations"];ngOnChanges(n){n.context&&(this.context?this.unregisterExplanationContext??=this.explanationGuide.registerContext("home.filters"):(this.unregisterExplanationContext?.(),this.unregisterExplanationContext=null),this.context&&(this.filterDraft=x(this.context.filter)));}onEscapePressed(n){n.defaultPrevented||(n.preventDefault(),n.stopPropagation(),this.requestClose());}get minAgeBound(){return i}get maxAgeBound(){return o}get minHeightBoundCm(){return r}get maxHeightBoundCm(){return g}gameFilterPopupModel(){return {title:"game.filters",ariaLabel:"home.filters.aria",closeAriaLabel:"close.filter.popup",size:"wide",height:"full",headerTone:"accent",bodyLayout:"fill",backdropTone:"dim",closeOnBackdrop:!this.saving,headerControls:this.gameFilterPopupHeaderControls(),onClose:n=>this.requestClose(n),onMenuSelect:n=>this.onGameFilterMenuSelect(n.itemSelect)}}gameFilterPopupZIndex(){return 10020}gameFilterPopupHeaderControls(){return [{kind:"menu",id:"game-filter-actions",menuKind:"inline",items:this.gameFilterPopupActionItems(),panelAlign:"end",closeOnSelect:false}]}gameFilterPopupActionItems(){return [{id:"game-filter-apply",icon:"check",kind:"action",palette:"green",disabled:this.saving||this.preparing(),ariaLabel:this.saving?"saving.filters":"apply.filters",progress:this.saving?{state:"loading",shape:"circle"}:null,context:{kind:"apply"}}]}filterMenuTitle(n){switch(n){case "interests":return "interest";case "values":return "values";case "physiques":return "physique";case "languages":return "profile.languages";case "genders":return "gender";case "horoscopes":return "profile.horoscope";case "traitLabels":return "top.trait";case "smoking":return "smoking";case "drinking":return "drinking";case "workout":return "workout";case "pets":return "pets";case "familyPlans":return "family.plans";case "children":return "children";case "loveStyles":return "love.style";case "communicationStyles":return "communication.style";case "sexualOrientations":return "sexual.orientation";case "religions":return "religion"}}filterMenuTrigger(n){return s$1(r$1(r$1(s$1(r$1({},this.profileFieldMenus.get(this.profileFieldIds[n]??"")?.trigger),{label:void 0}),n==="horoscopes"?{icon:"brightness_5",palette:"gold"}:{}),n==="traitLabels"?{icon:"stars",palette:"pink"}:{}),{layout:"field",ariaLabel:this.filterMenuTitle(n)})}filterMenuSearchable(n){return n==="languages"||n==="interests"||n==="values"}filterMenuModel(n){let e=this.menuModels.get(n);if(e?.selected===this.filterDraft[n])return e.model;let t=this.profileFieldMenus.get(this.profileFieldIds[n]??""),i=t?.model?.groups??[{id:`game-filter-${n}`,label:this.filterMenuTitle(n),items:t?.items??[]}];if(n==="horoscopes"?i=[{id:"horoscopes",items:Object.entries(ya.profileHoroscopeMetaBySign).map(([o,b])=>s$1(r$1({id:o,value:o},b),{iconKind:"text",surface:"tinted"}))}]:n==="traitLabels"&&(i=[{id:"traits",items:ya.personalityTraitCatalog.map(o=>({id:o.id,value:o.label,label:o.labelKey,icon:o.icon,surface:"tinted",palette:m$1("trait",o.label).menuPalette}))}]),n==="languages"){let o=i.flatMap(b=>b.items??[]);i=[{id:"languages-a-h",label:"A\u2013H"},{id:"languages-i-z",label:"I\u2013Z"}].map((b,K)=>s$1(r$1({},b),{icon:"language",palette:t?.trigger?.palette,items:o.filter(P=>`${P.value}`.toLowerCase()<"i"==(K===0)).sort((P,it)=>`${P.value}`.localeCompare(`${it.value}`))}));}let r=new Set(this.filterDraft[n].map(o=>o.trim().toLowerCase())),c=new Set,f=o=>{let b=`${o.value??o.id}`,K=b.trim().toLowerCase();c.add(K);let P=r.has(K);return {label:o.label,icon:o.icon,iconKind:o.iconKind,palette:o.palette,surface:o.surface,togglePalette:o.togglePalette,id:`game-filter-${n}-${o.id}`,value:b,kind:"checkbox",checked:P,active:P,removable:P,disabled:false,closeOnSelect:false,context:{kind:n,value:b}}},R=i.map(o=>s$1(r$1({},o),{headerActions:void 0,items:(o.items??[]).map(f)}));for(let o of this.filterDraft[n])c.has(o.trim().toLowerCase())||R[0].items.push(f({id:o,value:o,label:o}));let $={layout:"tabs",maxSelected:null,groups:R,summary:{emptyLabel:"any",maxLabels:2,counter:"overflow"}};return this.menuModels.set(n,{selected:this.filterDraft[n],model:$}),$}onGameFilterMenuSelect(n){let e=n.context;if(!e)return;if(e.kind==="apply"){this.apply();return}let t=`${n.value??e.value}`.trim();if(t){if(n.action==="remove"){this.removeFilterMenuValue(e.kind,t,n.sourceEvent);return}this.toggleGameFilterMenuValue(e.kind,t);}}requestClose(n){n?.stopPropagation(),!this.saving&&this.closed.emit(null);}apply(){this.saving||this.preparing()||this.closed.emit(y(this.filterDraft));}toggleGameFilterMenuValue(n,e){this.filterDraft[n]=this.toggleArraySelection(this.filterDraft[n],e);}removeFilterMenuValue(n,e,t){t?.stopPropagation(),this.filterDraft[n]=this.filterDraft[n].filter(i=>i.trim().toLowerCase()!==e.trim().toLowerCase());}onAgeMinChange(n){this.filterDraft.ageMin=Number(n),this.filterDraft.ageMin>this.filterDraft.ageMax&&(this.filterDraft.ageMax=this.filterDraft.ageMin);}onAgeMaxChange(n){this.filterDraft.ageMax=Number(n),this.filterDraft.ageMax<this.filterDraft.ageMin&&(this.filterDraft.ageMin=this.filterDraft.ageMax);}onHeightMinChange(n){this.filterDraft.heightMinCm=Number(n),this.filterDraft.heightMinCm>this.filterDraft.heightMaxCm&&(this.filterDraft.heightMaxCm=this.filterDraft.heightMinCm);}onHeightMaxChange(n){this.filterDraft.heightMaxCm=Number(n),this.filterDraft.heightMaxCm<this.filterDraft.heightMinCm&&(this.filterDraft.heightMinCm=this.filterDraft.heightMaxCm);}toggleArraySelection(n,e){let t=e.trim().toLowerCase();return n.some(r=>r.trim().toLowerCase()===t)?n.filter(r=>r.trim().toLowerCase()!==t):[...n,e]}static \u0275fac=function(e){return new(e||a)};static \u0275cmp=OI({type:a,selectors:[["app-home-game-filter-popup"]],hostBindings:function(e,t){e&1&&dh("keydown.escape",function(r){return t.onEscapePressed(r)},Iv);},inputs:{context:"context",saving:"saving"},outputs:{closed:"closed"},features:[Km],decls:1,vars:1,consts:[[3,"model","zIndex"],[3,"loading"],[1,"game-filter-body"],[1,"game-filter-layout-columns"],[1,"game-filter-layout-col","game-filter-layout-col-basics"],["data-guide-field","home-filter-basics",1,"game-filter-group","game-filter-group-basics"],[1,"game-filter-group-head"],[1,"game-filter-section-head"],[1,"game-filter-value-badge"],[1,"game-filter-slider-wrap"],[3,"min","max","step"],["matSliderStartThumb","",3,"ngModelChange","ngModel"],["matSliderEndThumb","",3,"ngModelChange","ngModel"],[1,"game-filter-menu-field"],[1,"game-filter-group","game-filter-group-beliefs"],[1,"game-filter-layout-col","game-filter-layout-col-lifestyle"],[1,"game-filter-group","game-filter-group-lifestyle"],[1,"game-filter-layout-col","game-filter-layout-col-relationships"],[1,"game-filter-group","game-filter-group-relationships"],["kind","select",1,"game-filter-menu",3,"itemSelect","title","filterable","trigger","model"]],template:function(e,t){e&1&&bD(0,yt,3,3,"app-popup",0),e&2&&_D(t.context?0:-1);},dependencies:[Mt$1,q3,Yt,_n,Et,yt$1,et,Ye,de,Zr,Ue],styles:["[_nghost-%COMP%]{display:contents}.game-filter-body[_ngcontent-%COMP%]{position:relative;flex:1 1 auto;min-height:0;width:100%;height:100%;box-sizing:border-box;display:grid;overflow:auto;padding:.4rem;grid-template-columns:1fr;gap:.72rem;align-items:start}.game-filter-layout-columns[_ngcontent-%COMP%]{grid-column:1/-1;display:grid;grid-template-columns:1fr;gap:.72rem;align-items:start}.game-filter-layout-col[_ngcontent-%COMP%]{min-width:0;display:grid;gap:.72rem;align-content:start}.game-filter-group[_ngcontent-%COMP%]{border:1px solid rgba(105,126,156,.24);border-radius:14px;background:linear-gradient(180deg,#f8fbff,#edf4ff);padding:.62rem;display:grid;gap:.48rem}.game-filter-group-head[_ngcontent-%COMP%]{display:flex;align-items:center;justify-content:space-between;padding-bottom:.22rem;border-bottom:1px solid rgba(74,102,139,.22)}.game-filter-group-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{margin:0;font-size:.84rem;letter-spacing:.01em;color:#20385c}.game-filter-group-basics[_ngcontent-%COMP%]{background:linear-gradient(180deg,#f2f7ff,#e8f0fb);border-color:#3a6ca847}.game-filter-group-basics[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]{border-bottom-color:#3a6ca83d}.game-filter-group-basics[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{color:#214772}.game-filter-group-beliefs[_ngcontent-%COMP%]{background:linear-gradient(180deg,#f4f1ff,#ebe6fb);border-color:#6254a347}.game-filter-group-beliefs[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]{border-bottom-color:#6254a33d}.game-filter-group-beliefs[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{color:#4f438b}.game-filter-group-lifestyle[_ngcontent-%COMP%]{background:linear-gradient(180deg,#eef8f3,#e4f2ea);border-color:#317c5247}.game-filter-group-lifestyle[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]{border-bottom-color:#317c523d}.game-filter-group-lifestyle[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{color:#2f6f45}.game-filter-group-relationships[_ngcontent-%COMP%]{background:linear-gradient(180deg,#fff4ee,#f7e9df);border-color:#a05a3347;grid-template-columns:1fr;align-content:start}.game-filter-group-relationships[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]{border-bottom-color:#a05a333d;grid-column:1/-1}.game-filter-group-relationships[_ngcontent-%COMP%]   .game-filter-group-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%]{color:#7d4e33}.game-filter-section-head[_ngcontent-%COMP%]{display:flex;align-items:center;justify-content:space-between;gap:.4rem}.game-filter-section-head[_ngcontent-%COMP%]   h4[_ngcontent-%COMP%]{margin:0;font-size:.82rem;color:#213b5f}.game-filter-value-badge[_ngcontent-%COMP%]{border:1px solid rgba(39,73,114,.22);border-radius:999px;background:linear-gradient(180deg,#f0f6ff,#e6eefb);color:#22436a;font-size:.74rem;font-weight:800;line-height:1;padding:.26rem .5rem;white-space:nowrap}.game-filter-slider-wrap[_ngcontent-%COMP%]{display:grid;gap:.44rem;padding:0 2rem;overflow:hidden}.game-filter-slider-wrap[_ngcontent-%COMP%]   mat-slider[_ngcontent-%COMP%]{width:100%}.game-filter-group-basics[_ngcontent-%COMP%]   .game-filter-slider-wrap[_ngcontent-%COMP%]   mat-slider[_ngcontent-%COMP%]{--mdc-slider-active-track-color: #2f6fbe;--mdc-slider-inactive-track-color: rgba(57, 88, 130, .36);--mdc-slider-handle-color: #1463be;--mdc-slider-focus-handle-color: #1463be;--mdc-slider-hover-handle-color: #1463be;--mdc-slider-pressed-handle-color: #0f5bac}[_nghost-%COMP%]     .game-filter-slider-wrap .mdc-slider__thumb:before, [_nghost-%COMP%]     .game-filter-slider-wrap .mdc-slider__thumb:after{display:none}[_nghost-%COMP%]     .game-filter-group-basics .game-filter-slider-wrap .mdc-slider__track--inactive{background-color:#3958825c!important;opacity:1}[_nghost-%COMP%]     .game-filter-group-basics .game-filter-slider-wrap .mdc-slider__track--active_fill{border-color:#2f6fbe!important}.game-filter-menu-field[_ngcontent-%COMP%]{min-width:0;display:grid;gap:.24rem}.game-filter-menu-field[_ngcontent-%COMP%] > span[_ngcontent-%COMP%]{min-width:0;color:#213b5f;font-size:.76rem;font-weight:700;line-height:1.1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.game-filter-menu[_ngcontent-%COMP%]{display:block;width:100%;min-width:0}.game-filter-layout-columns[_ngcontent-%COMP%]{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr) minmax(0,1fr);align-items:stretch}.game-filter-layout-col[_ngcontent-%COMP%]{align-content:stretch}.game-filter-layout-col-lifestyle[_ngcontent-%COMP%] > .game-filter-group-lifestyle[_ngcontent-%COMP%], .game-filter-layout-col-relationships[_ngcontent-%COMP%] > .game-filter-group-relationships[_ngcontent-%COMP%], .game-filter-layout-col-basics[_ngcontent-%COMP%] > .game-filter-group-beliefs[_ngcontent-%COMP%]{height:100%}.game-filter-layout-col-relationships[_ngcontent-%COMP%] > .game-filter-group-relationships[_ngcontent-%COMP%]{display:flex;flex-direction:column}.game-filter-layout-col-relationships[_ngcontent-%COMP%]   .game-filter-menu-field[_ngcontent-%COMP%]{flex:1 1 0;min-height:0}@media(max-width:760px){.game-filter-body[_ngcontent-%COMP%]{padding:.4rem .4rem calc(.75rem + env(safe-area-inset-bottom));max-height:none;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}.game-filter-layout-columns[_ngcontent-%COMP%]{grid-template-columns:1fr;padding-bottom:calc(.5rem + env(safe-area-inset-bottom))}.game-filter-layout-col[_ngcontent-%COMP%]{align-content:start}.game-filter-layout-col-lifestyle[_ngcontent-%COMP%] > .game-filter-group-lifestyle[_ngcontent-%COMP%], .game-filter-layout-col-relationships[_ngcontent-%COMP%] > .game-filter-group-relationships[_ngcontent-%COMP%], .game-filter-layout-col-basics[_ngcontent-%COMP%] > .game-filter-group-beliefs[_ngcontent-%COMP%]{height:auto}.game-filter-layout-col-relationships[_ngcontent-%COMP%] > .game-filter-group-relationships[_ngcontent-%COMP%]{display:grid;flex-direction:initial}.game-filter-layout-col-relationships[_ngcontent-%COMP%]   .game-filter-menu-field[_ngcontent-%COMP%]{flex:initial}}"],changeDetection:0})};export{tt as HomeGameFilterPopupComponent};