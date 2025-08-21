import { cameras, getCurrentCamera, setCurrentCamera, getViewMatrix, getProjectionMatrix } from './camera.js';
import { multiply4, invert4, rotate4, translate4 } from './math.js';
import { initStyleControls } from './styleControls.js';

import vertexShaderSource from './shaders/vertex.glsl?raw';
import fragmentShaderSource from './shaders/fragment.glsl?raw';

let defaultViewMatrix = [
    0.47, 0.04, 0.88, 0, -0.11, 0.99, 0.02, 0, -0.88, -0.11, 0.47, 0, 0.07,
    0.03, 6.55, 1,
];
let viewMatrix = defaultViewMatrix;
let vertexCount = 0;

async function main() {
    let carousel = true;
    const params = new URLSearchParams(location.search);
    try {
        viewMatrix = JSON.parse(decodeURIComponent(location.hash.slice(1)));
        carousel = false;
    } catch (err) {}

    const fileName = params.get("url") || "milk.splat";
    // put the model file (.splat) in /public 
    const url = new URL(fileName, window.location.origin);
    
    const req = await fetch(url, {
        mode: "cors",
        credentials: "omit",
    });
    
    if (req.status != 200)
        throw new Error(req.status + " Unable to load " + req.url);

    const rowLength = 3 * 4 + 3 * 4 + 4 + 4;
    const reader = req.body.getReader();
    let splatData = new Uint8Array(req.headers.get("content-length"));

    const downsample = splatData.length / rowLength > 500000 ? 1 : 1 / devicePixelRatio;
    console.log(splatData.length / rowLength, downsample);

    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });

    const canvas = document.getElementById("canvas");
    const fps = document.getElementById("fps");
    const camid = document.getElementById("camid");

    let projectionMatrix;

    const gl = canvas.getContext("webgl2", { antialias: false });

    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS))
        console.error(gl.getShaderInfoLog(vertexShader));

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS))
        console.error(gl.getShaderInfoLog(fragmentShader));

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
        console.error(gl.getProgramInfoLog(program));

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.ONE_MINUS_DST_ALPHA, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE);
    gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);

    const u_projection = gl.getUniformLocation(program, "projection");
    const u_viewport = gl.getUniformLocation(program, "viewport");
    const u_focal = gl.getUniformLocation(program, "focal");
    const u_view = gl.getUniformLocation(program, "view");

    const triangleVertices = new Float32Array([-2, -2, 2, -2, 2, 2, -2, 2]);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);
    const a_position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(a_position);
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    var u_textureLocation = gl.getUniformLocation(program, "u_texture");
    gl.uniform1i(u_textureLocation, 0);

    const indexBuffer = gl.createBuffer();
    const a_index = gl.getAttribLocation(program, "index");
    gl.enableVertexAttribArray(a_index);
    gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
    gl.vertexAttribIPointer(a_index, 1, gl.INT, false, 0, 0);
    gl.vertexAttribDivisor(a_index, 1);

    const resize = () => {
        const currentCam = getCurrentCamera();
        gl.uniform2fv(u_focal, new Float32Array([currentCam.fx, currentCam.fy]));
        projectionMatrix = getProjectionMatrix(currentCam.fx, currentCam.fy, innerWidth, innerHeight);
        gl.uniform2fv(u_viewport, new Float32Array([innerWidth, innerHeight]));
        gl.canvas.width = Math.round(innerWidth / downsample);
        gl.canvas.height = Math.round(innerHeight / downsample);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        gl.uniformMatrix4fv(u_projection, false, projectionMatrix);
    };

    window.addEventListener("resize", resize);
    resize();

    worker.onmessage = (e) => {
        if (e.data.buffer) {
            splatData = new Uint8Array(e.data.buffer);
            if (e.data.save) {
                const blob = new Blob([splatData.buffer], { type: "application/octet-stream" });
                const link = document.createElement("a");
                link.download = "model.splat";
                link.href = URL.createObjectURL(blob);
                document.body.appendChild(link);
                link.click();
            }
        } else if (e.data.texdata) {
            const { texdata, texwidth, texheight } = e.data;
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32UI, texwidth, texheight, 0, gl.RGBA_INTEGER, gl.UNSIGNED_INT, texdata);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
        } else if (e.data.depthIndex) {
            const { depthIndex } = e.data;
            gl.bindBuffer(gl.ARRAY_BUFFER, indexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, depthIndex, gl.DYNAMIC_DRAW);
            vertexCount = e.data.vertexCount;
        }
    };

    let activeKeys = [];
    let currentCameraIndex = 0;

    window.addEventListener("keydown", (e) => {
        carousel = false;
        if (!activeKeys.includes(e.code)) activeKeys.push(e.code);
        
        let cameraChanged = false;
        if (/\d/.test(e.key)) {
            currentCameraIndex = parseInt(e.key);
            cameraChanged = true;
        }
        if (["-", "_"].includes(e.key)) {
            currentCameraIndex = (currentCameraIndex + cameras.length - 1) % cameras.length;
            cameraChanged = true;
        }
        if (["+", "="].includes(e.key)) {
            currentCameraIndex = (currentCameraIndex + 1) % cameras.length;
            cameraChanged = true;
        }

        if (cameraChanged) {
            setCurrentCamera(cameras[currentCameraIndex]);
            viewMatrix = getViewMatrix(getCurrentCamera());
        }

        camid.innerText = "cam  " + currentCameraIndex;
        if (e.code == "KeyV") {
            location.hash = "#" + JSON.stringify(viewMatrix.map((k) => Math.round(k * 100) / 100));
            camid.innerText = "";
        } else if (e.code === "KeyP") {
            carousel = true;
            camid.innerText = "";
        }
    });
    window.addEventListener("keyup", (e) => {
        activeKeys = activeKeys.filter((k) => k !== e.code);
    });
    window.addEventListener("blur", () => {
        activeKeys = [];
    });

    window.addEventListener("wheel", (e) => {
        carousel = false;
        e.preventDefault();
        const lineHeight = 10;
        const scale = e.deltaMode == 1 ? lineHeight : e.deltaMode == 2 ? innerHeight : 1;
        let inv = invert4(viewMatrix);
        if (e.shiftKey) {
            inv = translate4(inv, (e.deltaX * scale) / innerWidth, (e.deltaY * scale) / innerHeight, 0);
        } else if (e.ctrlKey || e.metaKey) {
            inv = translate4(inv, 0, 0, (-10 * (e.deltaY * scale)) / innerHeight);
        } else {
            let d = 4;
            inv = translate4(inv, 0, 0, d);
            inv = rotate4(inv, -(e.deltaX * scale) / innerWidth, 0, 1, 0);
            inv = rotate4(inv, (e.deltaY * scale) / innerHeight, 1, 0, 0);
            inv = translate4(inv, 0, 0, -d);
        }
        viewMatrix = invert4(inv);
    }, { passive: false });

    let startX, startY, down;
    canvas.addEventListener("mousedown", (e) => {
        carousel = false;
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        down = e.ctrlKey || e.metaKey ? 2 : 1;
    });
    canvas.addEventListener("contextmenu", (e) => {
        carousel = false;
        e.preventDefault();
        startX = e.clientX;
        startY = e.clientY;
        down = 2;
    });

    canvas.addEventListener("mousemove", (e) => {
        e.preventDefault();
        if (down == 1) {
            let inv = invert4(viewMatrix);
            let dx = (5 * (e.clientX - startX)) / innerWidth;
            let dy = (5 * (e.clientY - startY)) / innerHeight;
            let d = 4;
            inv = translate4(inv, 0, 0, d);
            inv = rotate4(inv, dx, 0, 1, 0);
            inv = rotate4(inv, -dy, 1, 0, 0);
            inv = translate4(inv, 0, 0, -d);
            viewMatrix = invert4(inv);
            startX = e.clientX;
            startY = e.clientY;
        } else if (down == 2) {
            let inv = invert4(viewMatrix);
            inv = translate4(inv, (-10 * (e.clientX - startX)) / innerWidth, 0, (10 * (e.clientY - startY)) / innerHeight);
            viewMatrix = invert4(inv);
            startX = e.clientX;
            startY = e.clientY;
        }
    });
    canvas.addEventListener("mouseup", (e) => {
        e.preventDefault();
        down = false;
        startX = 0;
        startY = 0;
    });
    
    initStyleControls(gl, program);
    
    let jumpDelta = 0;
    let lastFrame = 0;
    let avgFps = 0;
    let start = 0;

    const frame = (now) => {
        let inv = invert4(viewMatrix);
        let shiftKey = activeKeys.includes("ShiftLeft") || activeKeys.includes("ShiftRight");

        if (activeKeys.includes("ArrowUp")) inv = translate4(inv, 0, 0, shiftKey ? 0.03 : 0.1);
        if (activeKeys.includes("ArrowDown")) inv = translate4(inv, 0, 0, shiftKey ? -0.03 : -0.1);
        if (activeKeys.includes("ArrowLeft")) inv = translate4(inv, -0.03, 0, 0);
        if (activeKeys.includes("ArrowRight")) inv = translate4(inv, 0.03, 0, 0);
        if (activeKeys.includes("KeyA")) inv = rotate4(inv, -0.01, 0, 1, 0);
        if (activeKeys.includes("KeyD")) inv = rotate4(inv, 0.01, 0, 1, 0);
        if (activeKeys.includes("KeyQ")) inv = rotate4(inv, 0.01, 0, 0, 1);
        if (activeKeys.includes("KeyE")) inv = rotate4(inv, -0.01, 0, 0, 1);
        if (activeKeys.includes("KeyW")) inv = rotate4(inv, 0.005, 1, 0, 0);
        if (activeKeys.includes("KeyS")) inv = rotate4(inv, -0.005, 1, 0, 0);

        viewMatrix = invert4(inv);

        if (carousel) {
            let inv = invert4(defaultViewMatrix);
            const t = Math.sin((Date.now() - start) / 5000);
            inv = translate4(inv, 2.5 * t, 0, 6 * (1 - Math.cos(t)));
            inv = rotate4(inv, -0.6 * t, 0, 1, 0);
            viewMatrix = invert4(inv);
        }
        
        let isJumping = activeKeys.includes("Space");
        if (isJumping) jumpDelta = Math.min(1, jumpDelta + 0.05);
        else jumpDelta = Math.max(0, jumpDelta - 0.05);

        let inv2 = invert4(viewMatrix);
        inv2 = translate4(inv2, 0, -jumpDelta, 0);
        inv2 = rotate4(inv2, -0.1 * jumpDelta, 1, 0, 0);
        let actualViewMatrix = invert4(inv2);

        const viewProj = multiply4(projectionMatrix, actualViewMatrix);
        worker.postMessage({ view: viewProj });

        const currentFps = 1000 / (now - lastFrame) || 0;
        avgFps = avgFps * 0.9 + currentFps * 0.1;

        if (vertexCount > 0) {
            document.getElementById("spinner").style.display = "none";
            gl.uniformMatrix4fv(u_view, false, actualViewMatrix);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArraysInstanced(gl.TRIANGLE_FAN, 0, 4, vertexCount);
        } else {
            gl.clear(gl.COLOR_BUFFER_BIT);
            document.getElementById("spinner").style.display = "";
            start = Date.now() + 2000;
        }
        const progress = (100 * vertexCount) / (splatData.length / rowLength);
        if (progress < 100) {
            document.getElementById("progress").style.width = progress + "%";
        } else {
            document.getElementById("progress").style.display = "none";
        }
        fps.innerText = Math.round(avgFps) + " fps";
        if (isNaN(currentCameraIndex)) {
            camid.innerText = "";
        }
        lastFrame = now;
        requestAnimationFrame(frame);
    };

    frame();
    
    const isPly = (splatData) => splatData[0] === 112 && splatData[1] === 108 && splatData[2] === 121 && splatData[3] === 10;
    
    let bytesRead = 0;
    let lastVertexCount = -1;
    let stopLoading = false;

    while (true) {
        const { done, value } = await reader.read();
        if (done || stopLoading) break;
        splatData.set(value, bytesRead);
        bytesRead += value.length;

        if (vertexCount > lastVertexCount) {
            if (!isPly(splatData)) {
                worker.postMessage({ buffer: splatData.buffer, vertexCount: Math.floor(bytesRead / rowLength) });
            }
            lastVertexCount = vertexCount;
        }
    }

    if (!stopLoading) {
        if (isPly(splatData)) {
            worker.postMessage({ ply: splatData.buffer, save: false });
        } else {
            worker.postMessage({ buffer: splatData.buffer, vertexCount: Math.floor(bytesRead / rowLength) });
        }
    }
}

main().catch((err) => {
    document.getElementById("spinner").style.display = "none";
    document.getElementById("message").innerText = err.toString();
});