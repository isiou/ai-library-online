import os
import re
import json
import ollama
import google.generativeai as genai
from google.generativeai import types
from abc import ABC, abstractmethod
from config import OLLAMA_MODEL, GEMINI_MODEL, GEMINI_API_KEY


class RecommendationClient(ABC):
    @abstractmethod
    def get_recommendations(
        self, recent_books: list, query: str = "", limit: int = 5, retries: int = 2
    ) -> list:
        pass


class OllamaClient(RecommendationClient):
    def get_recommendations(
        self, recent_books: list, query: str = "", limit: int = 5, retries: int = 2
    ) -> list:
        system_prompt = self._get_system_prompt()

        # 构建用户提示词结合历史记录和关键词
        if recent_books and query:
            # 有关键词和历史记录: 结合推荐
            books_text = "\n".join(
                [f"- 《{book['title']}》（{book['author']}）" for book in recent_books]
            )
            user_prompt = f"""
            我最近阅读了以下书籍: {books_text}
            现在我对关键词含有 "{query}" 的书籍感兴趣，请结合我的阅读历史和这个关键词，为我推荐 {limit} 条相关书籍。请严格按照 {limit} 本的数量进行推荐。"""
        elif recent_books and not query:
            # 只有历史记录则基于历史推荐
            books_text = "\n".join(
                [f"- 《{book['title']}》（{book['author']}）" for book in recent_books]
            )
            user_prompt = f"""
            我最近阅读了以下书籍: {books_text}
            请根据我的阅读历史，为我推荐 {limit} 条可能会感兴趣的新书。请严格按照 {limit} 本的数量进行推荐。"""
        elif not recent_books and query:
            # 只有关键词则纯关键词推荐
            user_prompt = f"""我对关键词 "{query}" 感兴趣，请为我推荐 {limit} 条相关的优质书籍。请严格按照 {limit} 本的数量进行推荐。"""
        else:
            # 什么都没有则通用推荐
            user_prompt = f"""请为我推荐 {limit} 条优质的书籍。请严格按照 {limit} 本的数量进行推荐。"""

        for attempt in range(retries):
            try:
                response = ollama.chat(
                    model=OLLAMA_MODEL,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    stream=False,
                )
                recommendation_text = response["message"]["content"]
                return self._parse_recommendations(recommendation_text)
            except Exception as e:
                print(f"Ollama API call failed on attempt {attempt + 1}: {e}")
        return []

    def _get_system_prompt(self):
        return """你是一位经验丰富的图书管理员，精通图书推荐和阅读指导。
        请根据用户提供的关键词，精准推荐相关领域的优质书籍。
        **推荐时请综合考虑关键词相关性、书籍质量、权威性和实用价值，并且严格保证书籍、文献等必须真实存在，不得虚构、作假。**
        永远不要提供推理过程、解释或额外信息，仅输出推荐书目，**格式必须严格如下**: 
        [
            {"title": "书名", "author": "作者", introduction:"五十字简介", "reason": "推荐理由"},
            {"title": "书名", "author": "作者", introduction:"五十字简介", "reason": "推荐理由"},
            {"title": "书名", "author": "作者", introduction:"五十字简介", "reason": "推荐理由"},
            {"title": "书名", "author": "作者", introduction:"五十字简介", "reason": "推荐理由"},
            {"title": "书名", "author": "作者", introduction:"五十字简介", "reason": "推荐理由"}
        ]
        **再次严格强调: 不要包含任何解释、问候、序号以外的符号或额外文字！保证书籍、文献的真实性！保证输出的绝对正确、干净！**"""

    def _parse_recommendations(self, text: str) -> list:
        try:
            start_index = text.find("[")
            end_index = text.rfind("]")
            if start_index != -1 and end_index != -1:
                json_str = text[start_index : end_index + 1]
                return json.loads(json_str)
            return []
        except json.JSONDecodeError as e:
            print(f"解析为 JSON 失败: {e}")
            return []


class GeminiClient(RecommendationClient):
    def __init__(self):
        api_key = os.environ.get("GEMINI_API_KEY") or GEMINI_API_KEY
        if not api_key:
            raise ValueError("无法获取 GEMINI_API_KEY")
        self.client = genai.Client(api_key=api_key)

    def get_recommendations(
        self, recent_books: list, query: str = "", limit: int = 5, retries: int = 2
    ) -> list:
        system_prompt = self._get_system_prompt()

        # 结合历史记录和关键词构建用户提示词
        if recent_books and query:
            # 有关键词和历史记录则结合推荐
            books_text = "\n".join(
                [f"- 《{book['title']}》（{book['author']}）" for book in recent_books]
            )
            user_prompt = f"""
            我最近阅读了以下书籍: {books_text}
            现在我对含关键词 "{query}" 的书籍感兴趣，请结合我的阅读历史和这个关键词，为我推荐 {limit} 条相关书籍。请严格按照 {limit} 本的数量进行推荐。"""
        elif recent_books and not query:
            # 只有历史记录则基于历史推荐
            books_text = "\n".join(
                [f"- 《{book['title']}》（{book['author']}）" for book in recent_books]
            )
            user_prompt = f"""
            我最近阅读了以下书籍: {books_text}
            请根据我的阅读历史，为我推荐 {limit} 条可能会感兴趣的新书。请严格按照 {limit} 本的数量进行推荐。"""
        elif not recent_books and query:
            # 只有关键词则纯关键词推荐
            user_prompt = f"""我对关键词 "{query}" 的书籍感兴趣，请为我推荐 {limit} 条相关的优质书籍。请严格按照 {limit} 本的数量进行推荐。"""
        else:
            # 什么都没有则通用推荐
            user_prompt = f"""请为我推荐 {limit} 条优质的书籍。请严格按照 {limit} 本的数量进行推荐。"""

        for attempt in range(retries):
            try:
                response = self.client.models.generate_content(
                    model=GEMINI_MODEL,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt
                    ),
                    contents=user_prompt,
                )
                return self._parse_recommendations(response.text)
            except Exception as e:
                print(f"Gemini 调用失败 -> {attempt + 1}: {e}")
        return []

    def _get_system_prompt(self):
        return """你是一位经验丰富的图书管理员，精通图书推荐和阅读指导。
        请根据用户提供的关键词，精准推荐相关领域的优质书籍。
        **推荐时请综合考虑关键词相关性、书籍质量、权威性和实用价值，并且严格保证书籍、文献等必须真实存在，不得虚构、作假。**
        永远不要提供推理过程、解释或额外信息，仅输出推荐书目，**格式必须严格如下**: 
        [
            {"title": "书名", "author": "作者", introduction:"五十字简介", "reason": "推荐理由"},
            {"title": "书名", "author": "作者", introduction:"五十字简介", "reason": "推荐理由"},
            {"title": "书名", "author": "作者", introduction:"五十字简介", "reason": "推荐理由"},
            {"title": "书名", "author": "作者", introduction:"五十字简介", "reason": "推荐理由"},
            {"title": "书名", "author": "作者", introduction:"五十字简介", "reason": "推荐理由"}
        ]
        **再次严格强调: 不要包含任何解释、问候、序号以外的符号或额外文字！保证书籍、文献的真实性！保证输出的绝对正确、干净！**"""

    def _parse_recommendations(self, text: str) -> list:
        try:
            start_index = text.find("[")
            end_index = text.rfind("]")
            if start_index != -1 and end_index != -1:
                json_str = text[start_index : end_index + 1]
                return json.loads(json_str)
            return []
        except json.JSONDecodeError as e:
            print(f"解析为 JSON 失败: {e}")
            return []


def get_recommendation_client(model: str) -> RecommendationClient:
    if model.lower() == "gemini":
        return GeminiClient()
    elif model.lower() == "ollama":
        return OllamaClient()
    else:
        raise ValueError(f"传入未知模型: {model}")
