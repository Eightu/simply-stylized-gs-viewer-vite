# 🎨 Simply Stylized Gaussian Splatting Viewer (Vite Edition)

[![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![WebGL](https://img.shields.io/badge/WebGL-2.0-blue?style=for-the-badge&logo=webgl)](https://www.khronos.org/webgl/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)

This is a modular 3D Gaussian Splatting viewer built on Vite. It enables efficient rendering, adds a variety of artistic stylization effects through custom GLSL shaders, and provides interactive UI controls.

> **Note:** This project is a fork of [antimatter15/splat](https://github.com/antimatter15/splat) with additional features and improvements. We would like to express our gratitude to the original author for their groundbreaking work!

![example](https://i.imgur.com/byfeebE.png)

---

### ✨ Main Features

-   **🎨 Multiple Render Styles**：In addition to the original realistic color rendering, it features multiple artistic styles such as Japanese animation, watercolor, and sketch.
-   **⚙️ Modular Codebase**：The project code is clearly divided into camera, math library, WebGL utilities, and Worker modules, making it easy to maintain and extend.

---

### 🛠️ Local Development and Running

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/YourUsername/stylized-gaussian-splatting-vite.git
    cd stylized-gaussian-splatting-vite
    ```

2.  **Install Dependencies**

    ```bash
    npm install
    ```

3.  **Start the Development Server**
    ```bash
    npm run dev
    ```
    Now, you can open the specified local address in your browser (usually `http://localhost:5173`).

4.  **Load the Model**
    -   Place your `.splat` file in the `public/` directory.
    -   Specify the model filename via URL parameter, e.g., `http://localhost:5173/?url=your-model-name.splat`.
    -   Default loads `public/train.splat`.

---

### 🕹️ Interaction Guide

-   **Mouse Left Drag**: Rotate the view.
-   **Mouse Wheel**: Zoom in and out.
-   **Ctrl/Cmd + Mouse Left Drag**: Pan the view.
-   **Keyboard `W/A/S/D/Q/E`**: Move and rotate the camera.
-   **Keyboard Number Keys `0-9`**: Switch to preset camera viewpoints.
-   **UI Controls**: Toggle rendering styles, adjust outline and texture intensity.

---

### 🙏 Thanks

This project wouldn't have been possible without the following open-source projects:

-   **[antimatter15/splat](https://github.com/antimatter15/splat)**: The core algorithm and original implementation source.
-   **[Vite](https://vitejs.dev/)**: The next-generation front-end development and build tool.

### 📄 License

This project is licensed under the [MIT License](LICENSE).
