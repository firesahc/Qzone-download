// ==UserScript==
// @name         Qzone-download
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  new
// @author       firesahc
// @match        https://user.qzone.qq.com/*
// @grant        GM_addStyle
// @grant        GM_download
// ==/UserScript==

(function() {
    'use strict';

    // 添加样式
    GM_addStyle(`
        .download-controls {
            margin: 10px 0;
            padding: 8px;
            background: #f5f5f5;
            border-radius: 4px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }
        .download-btn, .select-all-btn {
            padding: 6px 12px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: background 0.3s;
        }
        .download-btn:hover, .select-all-btn:hover {
            background: #45a049;
        }
        .media-checkbox {
            position: absolute;
            top: 8px;
            left: 8px;
            z-index: 100;
            width: 20px;
            height: 20px;
            cursor: pointer;
            background-color: white;
            border-radius: 3px;
        }
        .media-container {
            position: relative;
            display: inline-block;
        }
    `);

    // 主函数
    function init() {
        // 清理之前添加的控件
        document.querySelectorAll('.download-controls, .media-checkbox').forEach(el => {
            if (el.parentNode) {
                el.parentNode.removeChild(el);
            }
        });

        const msgList = document.getElementById('msgList');
        if (!msgList) {
            console.log('未找到消息列表');
            return;
        }

        // 遍历所有消息项
        const listItems = msgList.querySelectorAll('li');
        listItems.forEach(li => {
            const box = li.querySelector('div.box.bgr3');
            if (!box) return;

            // 查找div.md内容区域
            const mdDiv = box.querySelector('div.md');
            if (!mdDiv) return;

            // 查找所有图片和视频
            const medias = [];
            const images = mdDiv.querySelectorAll('img');
            const videos = mdDiv.querySelectorAll('video');

            // 收集图片 - 优先使用data-src
            images.forEach(img => {
                const src = img.dataset.src || img.src;
                if (src) {
                    medias.push({
                        type: 'image',
                        element: img,
                        src: src
                    });
                }
            });

            // 收集视频 - 优先使用data-src，过滤blob视频
            videos.forEach(video => {
                const src = video.dataset.src || video.src;
                if (src && !src.startsWith('blob:')) {
                    medias.push({
                        type: 'video',
                        element: video,
                        src: src
                    });
                }
            });

            // 如果没有可下载资源则跳过
            if (medias.length === 0) return;

            // 创建下载控制区域
            const controlsDiv = document.createElement('div');
            controlsDiv.className = 'download-controls';
            mdDiv.appendChild(controlsDiv);

            // 创建下载按钮
            const downloadBtn = createButton('下载', () => {
                if (medias.length === 1) {
                    downloadMedia(medias[0].src, medias[0].type);
                } else {
                    const selected = getSelectedMedia(mdDiv);
                    if (selected.length > 0) {
                        selected.forEach(media => downloadMedia(media.src, media.type));
                    } else {
                        alert('请至少选择一个资源');
                    }
                }
            });

            controlsDiv.appendChild(downloadBtn);

            // 如果有多项资源，添加全选/取消全选按钮
            if (medias.length > 1) {
                // 全选/取消全选按钮
                const selectAllBtn = createButton('取消全选', function() {
                    const checkboxes = mdDiv.querySelectorAll('.media-checkbox');
                    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

                    // 切换所有复选框状态
                    checkboxes.forEach(cb => {
                        cb.checked = !allChecked;
                    });

                    // 更新按钮文本
                    this.textContent = allChecked ? '全选' : '取消全选';
                });

                selectAllBtn.classList.add('select-all-btn');
                controlsDiv.appendChild(selectAllBtn);

                // 为每个媒体元素添加复选框
                medias.forEach(media => {
                    addCheckboxToMedia(media.element);
                });
            }
        });
    }

    // 为媒体元素添加复选框
    function addCheckboxToMedia(mediaElement) {
        // 获取媒体元素的父容器
        const container = mediaElement.parentElement;

        // 确保容器是相对定位
        if (getComputedStyle(container).position === 'static') {
            container.style.position = 'relative';
        }

        // 创建复选框
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'media-checkbox';
        checkbox.checked = true;
        checkbox.style.position = 'absolute';
        checkbox.style.top = '8px';
        checkbox.style.left = '8px';
        checkbox.style.zIndex = '100';
        checkbox.style.width = '20px';
        checkbox.style.height = '20px';
        checkbox.style.cursor = 'pointer';
        checkbox.style.backgroundColor = 'white';
        checkbox.style.borderRadius = '3px';

        // 添加到媒体容器
        container.appendChild(checkbox);
    }

    // 创建按钮元素
    function createButton(text, onClick) {
        const btn = document.createElement('button');
        btn.textContent = text;
        btn.className = 'download-btn';
        btn.addEventListener('click', onClick);
        return btn;
    }

    // 获取选中的媒体资源
    function getSelectedMedia(mdDiv) {
        const selected = [];
        mdDiv.querySelectorAll('.media-checkbox').forEach(checkbox => {
            if (checkbox.checked) {
                // 找到与复选框最近的媒体元素
                const container = checkbox.parentElement;
                const media = container.querySelector('img, video');
                if (media) {
                    // 优先使用data-src属性
                    const src = media.dataset.src || media.src;
                    if (src) {
                        selected.push({
                            src: src,
                            type: media.tagName.toLowerCase()
                        });
                    }
                }
            }
        });
        return selected;
    }

    // 下载媒体资源
    function downloadMedia(url, type) {
        const extension = type === 'video' ? 'mp4' : (url.match(/\.([a-z0-9]+)(?:[?#]|$)/i)?.[1] || 'jpg');
        const filename = `download_${Date.now()}.${extension}`;

        try {
            // 使用GM_download API进行下载
            GM_download({
                url: url,
                name: filename,
                onload: function() {
                    console.log('下载成功:', filename);
                },
                onerror: function(e) {
                    console.error('下载失败:', e);
                    fallbackDownload(url, filename);
                }
            });
        } catch (e) {
            console.log('使用GM_download失败，尝试备用方法');
            fallbackDownload(url, filename);
        }
    }

    // 备用的下载方法
    function fallbackDownload(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
        }, 100);
    }

    // 设置MutationObserver监听msgList变化
    function setupMutationObserver() {
        const msgList = document.getElementById('msgList');
        if (!msgList) {
            console.log('未找到msgList，稍后重试');
            setTimeout(setupMutationObserver, 1000);
            return;
        }

        // 创建MutationObserver实例
        const observer = new MutationObserver(mutations => {
            // 检查是否有实际内容变化
            const hasContentChange = mutations.some(mutation => {
                // 检查是否是子节点变化
                if (mutation.type === 'childList') {
                    // 检查是否有添加或删除的<li>元素
                    return Array.from(mutation.addedNodes).some(node =>
                        node.nodeType === 1 && node.tagName === 'LI'
                    ) || Array.from(mutation.removedNodes).some(node =>
                        node.nodeType === 1 && node.tagName === 'LI'
                    );
                }
                return false;
            });

            if (hasContentChange) {
                console.log('msgList内容变化，重新初始化下载助手');
                // 延迟执行以等待DOM完全更新
                setTimeout(init, 300);
            }
        });

        // 配置观察选项
        const config = {
            childList: true,  // 观察直接子节点变化
            subtree: true    // 观察所有后代节点变化
        };

        // 开始观察
        observer.observe(msgList, config);
        console.log('已设置MutationObserver监听msgList变化');
    }

    // 确保DOM加载完成后执行
    function main() {
        // 初始执行
        setTimeout(init, 1000);

        // 设置MutationObserver监听
        setTimeout(setupMutationObserver, 1500);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        main();
    } else {
        window.addEventListener('load', main);
    }
})();
