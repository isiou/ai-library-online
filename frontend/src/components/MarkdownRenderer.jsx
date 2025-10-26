import React, { useMemo } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js";
import "highlight.js/styles/github.css";
import "./MarkdownRenderer.css";

const MarkdownRenderer = ({ content, className = "" }) => {
  const renderedHTML = useMemo(() => {
    if (!content) return "";

    // 配置marked选项
    marked.setOptions({
      highlight: function (code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {
            console.error("代码高亮失败:", err);
          }
        }
        return hljs.highlightAuto(code).value;
      },
      breaks: true, // 支持换行
      gfm: true, // 启用GitHub风格 markdown
      tables: true, // 支持表格
      sanitize: false, // 我们使用DOMPurify来清理
      smartLists: true, // 智能列表
      smartypants: true, // 智能标点
    });

    try {
      // 预处理内容，移除首尾的空白字符和多余的换行
      const cleanContent = content.trim().replace(/\n{3,}/g, "\n\n");

      // 渲染markdown
      let html = marked.parse(cleanContent);

      // 使用DOMPurify清理HTML，只允许安全的标签和属性
      html = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "p",
          "br",
          "strong",
          "em",
          "u",
          "s",
          "del",
          "ins",
          "ul",
          "ol",
          "li",
          "blockquote",
          "code",
          "pre",
          "a",
          "img",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "hr",
          "div",
          "span",
        ],
        ALLOWED_ATTR: [
          "href",
          "title",
          "alt",
          "src",
          "width",
          "height",
          "class",
          "id",
        ],
        ALLOW_DATA_ATTR: false,
      });

      // 移除HTML末尾的空白和换行符
      html = html.trim().replace(/\s+$/g, "");

      return html;
    } catch (error) {
      console.error("Markdown渲染失败:", error);
      return `<p>${content}</p>`;
    }
  }, [content]);

  if (!content) return null;

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: renderedHTML }}
    />
  );
};

export default MarkdownRenderer;
