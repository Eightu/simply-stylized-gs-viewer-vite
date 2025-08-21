#version 300 es
precision highp float;

// Simplex Noise
// Author: Ian McEwan, Ashima Arts.
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                        0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                       -0.577350269189626,  // -1.0 + 2.0 * C.x
                        0.024390243902439); // 1.0 / 41.0
    vec2 i  = floor(v + dot(v, C.yy) );
    vec2 x0 = v -   i + dot(i, C.xx);
    vec2 i1;
    i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
    vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
    m = m*m;
    m = m*m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
    vec3 g;
    g.x  = a0.x  * x0.x  + h.x  * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
}

in vec4 vColor;
in vec2 vPosition;
out vec4 fragColor;

// 预定义多种调色板
vec3 defaultPalette[5] = vec3[](
    vec3(0.15, 0.15, 0.45),
    vec3(0.35, 0.35, 0.75),
    vec3(0.65, 0.65, 0.95),
    vec3(0.90, 0.70, 0.30),
    vec3(0.95, 0.45, 0.25)
);

vec3 animePalette[5] = vec3[](
    vec3(0.05, 0.05, 0.25),
    vec3(0.15, 0.15, 0.55),
    vec3(0.35, 0.35, 0.85),
    vec3(0.85, 0.65, 0.25),
    vec3(0.95, 0.90, 0.65)
);

vec3 watercolorPalette[5] = vec3[](
    vec3(0.25, 0.15, 0.10),
    vec3(0.45, 0.30, 0.20),
    vec3(0.75, 0.55, 0.40),
    vec3(0.90, 0.75, 0.60),
    vec3(0.98, 0.95, 0.90)
);

vec3 sketchPalette[5] = vec3[](
    vec3(0.10, 0.10, 0.10),
    vec3(0.25, 0.25, 0.25),
    vec3(0.50, 0.50, 0.50),
    vec3(0.75, 0.75, 0.75),
    vec3(0.95, 0.95, 0.95)  
);

vec3[5] getPalette(int style) {
    if (style == 1) return animePalette;
    if (style == 2) return watercolorPalette;
    if (style == 3) return sketchPalette;
    return defaultPalette;
}

vec3 closestColor(vec3 color, vec3[5] palette) {
    float minDist = 10.0;
    vec3 closest = color;
    for (int i = 0; i < 5; i++) {
        float dist = distance(color, palette[i]);
        if (dist < minDist) {
            minDist = dist;
            closest = palette[i];
        }
    }
    return closest;
}

uniform int style;
uniform float textureStrength;
uniform float edgeStrength;

void main() {
    float A = -dot(vPosition, vPosition);
    if (A < -4.0) discard;
    float B = exp(A) * vColor.a;
    
    vec3 originalColor = vColor.rgb;
    vec3 finalColor;
    
    if (style == -1) {
        finalColor = originalColor;
        float depthFactor = 1.0 - smoothstep(0.0, 2.0, -A);
        finalColor = mix(finalColor, finalColor * 1.25, depthFactor);
    } else {
        vec3[5] palette = getPalette(style);
        vec3 stylizedColor = closestColor(originalColor, palette);

        if (style == 2) {
            float grain = (snoise(vPosition.xy * 60.0) * 0.5 + 0.5); 
            stylizedColor += vec3(grain) * 0.15 * textureStrength;
            // stylizedColor = stylizedColor + vec3(grain);
        } else if (style == 3) {

            float lines = 0.0;
            // Simplex Noise
            float handDrawnOffset = snoise(vPosition.xy * 20.0) * 0.4;
            for (int i = 0; i < 3; i++) {
                float angle = float(i) * 2.094;
                vec2 dir = vec2(cos(angle), sin(angle));
                lines += smoothstep(0.45, 0.5, fract(dot(vPosition * 15.0, dir) + handDrawnOffset));
            }
            lines = clamp(lines / 3.0, 0.0, 1.0);

            stylizedColor = mix(stylizedColor, palette[0], lines * textureStrength);
        }

        float depthFactor = 1.0 - smoothstep(0.0, 2.0, -A);
        stylizedColor = mix(stylizedColor, stylizedColor * 1.25, depthFactor);        

        finalColor = stylizedColor;
    }
    
    // test
    vec3 finalRenderColor = finalColor;

    if (style != -1) {
        float edge = smoothstep(3.5, 4.0, -A) * edgeStrength;
        edge = smoothstep(0.2, 0.3, edge);

        vec3 edgeColor = getPalette(style)[0] * 0.75;
        
        finalRenderColor = mix(finalColor, edgeColor, edge);
    }
    
    fragColor = vec4(B * finalRenderColor, B);
}