import os
import sys
import argparse
from pathlib import Path
import subprocess
from concurrent.futures import ThreadPoolExecutor
import time


def format_file_with_black(file_path, black_args=None):
    if black_args is None:
        black_args = []

    try:
        cmd = [sys.executable, "-m", "black"] + black_args + [str(file_path)]

        result = subprocess.run(cmd, capture_output=True, text=True, check=False)

        if result.returncode == 0:
            return file_path, True, "格式化成功"
        else:
            return file_path, False, f"格式化失败: {result.stderr}"

    except Exception as e:
        return file_path, False, f"执行错误: {str(e)}"


def find_python_files(directory, exclude_dirs=None):
    if exclude_dirs is None:
        exclude_dirs = ["__pycache__", ".git", ".venv", "venv", "env", "node_modules"]

    python_files = []
    directory_path = Path(directory)

    for py_file in directory_path.rglob("*.py"):
        if any(exclude_dir in py_file.parts for exclude_dir in exclude_dirs):
            continue
        python_files.append(py_file)

    return python_files


def format_directory(directory, black_args=None, max_workers=None):
    if black_args is None:
        black_args = []

    print(f"正在查找 {directory} 中的 Python 文件...")
    python_files = find_python_files(directory)

    if not python_files:
        print("未找到 Python 文件")
        return {"total": 0, "success": 0, "failed": 0}

    print(f"找到 {len(python_files)} 个 Python 文件")
    print("开始格式化...")

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(format_file_with_black, file_path, black_args)
            for file_path in python_files
        ]

        results = []
        for i, future in enumerate(futures, 1):
            file_path, success, message = future.result()
            status = "OK" if success else "ERROR"
            print(f"[{i}/{len(python_files)}] {status} {file_path}")
            if not success and message:
                print(f"错误: {message}")
            results.append((file_path, success, message))

    success_count = sum(1 for _, success, _ in results if success)
    failed_count = len(results) - success_count

    print(f"\n格式化完成")
    print(f"总计: {len(results)} 个文件")
    print(f"成功: {success_count} 个文件")
    print(f"失败: {failed_count} 个文件")

    return {
        "total": len(results),
        "success": success_count,
        "failed": failed_count,
        "details": results,
    }


def main():
    parser = argparse.ArgumentParser(
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument("directory", nargs="?", default=".")

    parser.add_argument("--line-length", type=int, default=88)

    parser.add_argument("--check", action="store_true")

    parser.add_argument("--diff", action="store_true")

    parser.add_argument("--workers", type=int, default=4)

    parser.add_argument(
        "--exclude",
        nargs="+",
        default=["__pycache__", ".git", ".venv", "venv", "env", "node_modules"],
    )

    args = parser.parse_args()

    if not os.path.exists(args.directory):
        print(f"目录 '{args.directory}' 不存在")
        sys.exit(1)

    black_args = [f"--line-length={args.line_length}"]

    if args.check:
        black_args.append("--check")

    if args.diff:
        black_args.append("--diff")

    # 执行格式化
    start_time = time.time()
    results = format_directory(args.directory, black_args, args.workers)
    end_time = time.time()

    print(f"耗时: {end_time - start_time:.2f} 秒")

    if args.check and results["failed"] > 0:
        sys.exit(1)


if __name__ == "__main__":
    # python format.py .                    # 格式化当前目录
    # python format.py /path/               # 格式化指定目录
    # python format.py . --line-length 100  # 设置行长度为 100
    # python format.py . --check            # 只检查不格式化
    # python format.py . --diff             # 显示差异
    # python format.py . --workers 4        # 指定线程数
    main()
