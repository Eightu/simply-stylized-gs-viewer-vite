export function initStyleControls(gl, program) {
    let currentStyle = -1; // Real Color
    let edgeStrength = 0.7;
    let textureStrength = 0.5;

    const styleSelector = document.getElementById('style-selector');
    const edgeStrengthSlider = document.getElementById('edge-strength');
    const textureStrengthSlider = document.getElementById('texture-strength');

    const u_style = gl.getUniformLocation(program, "style");
    const u_edgeStrength = gl.getUniformLocation(program, "edgeStrength");
    const u_textureStrength = gl.getUniformLocation(program, "textureStrength");

    gl.uniform1i(u_style, currentStyle);
    gl.uniform1f(u_edgeStrength, edgeStrength);
    gl.uniform1f(u_textureStrength, textureStrength);
    
    styleSelector.addEventListener('change', (e) => {
        currentStyle = parseInt(e.target.value);
        gl.uniform1i(u_style, currentStyle);
    });
    
    edgeStrengthSlider.addEventListener('input', (e) => {
        edgeStrength = e.target.value / 100.0;
        gl.uniform1f(u_edgeStrength, edgeStrength);
    });
    
    textureStrengthSlider.addEventListener('input', (e) => {
        textureStrength = e.target.value / 100.0;
        if (u_textureStrength !== null) gl.uniform1f(u_textureStrength, textureStrength);
    });
}