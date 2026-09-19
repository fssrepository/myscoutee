function a(n){let e=!1,t=requestAnimationFrame(()=>{t=requestAnimationFrame(()=>{e||n()})});return()=>{e=!0,cancelAnimationFrame(t)}}export{a};
