# Đóng Góp cho Roo Code

Chúng tôi rất vui mừng vì bạn quan tâm đến việc đóng góp cho Roo Code. Cho dù bạn đang sửa lỗi, thêm tính năng, hay cải thiện tài liệu của chúng tôi, mỗi đóng góp đều làm cho Roo Code thông minh hơn! Để giữ cho cộng đồng của chúng tôi sôi động và thân thiện, tất cả thành viên phải tuân thủ [Quy Tắc Ứng Xử](CODE_OF_CONDUCT.md) của chúng tôi.

## Tham Gia Cộng Đồng của Chúng Tôi

Chúng tôi mạnh mẽ khuyến khích tất cả người đóng góp tham gia [cộng đồng Discord](https://discord.gg/roocode) của chúng tôi! Việc là một phần của máy chủ Discord của chúng tôi giúp bạn:

- Nhận hỗ trợ và hướng dẫn thời gian thực về đóng góp của bạn
- Kết nối với những người đóng góp khác và các thành viên nhóm cốt lõi
- Cập nhật về sự phát triển và ưu tiên của dự án
- Tham gia vào các cuộc thảo luận định hình tương lai của Roo Code
- Tìm cơ hội hợp tác với các nhà phát triển khác

## Báo Cáo Lỗi hoặc Vấn Đề

Báo cáo lỗi giúp cải thiện Roo Code cho mọi người! Trước khi tạo một vấn đề mới, vui lòng [tìm kiếm những vấn đề hiện có](https://github.com/RooVetGit/Roo-Code/issues) để tránh trùng lặp. Khi bạn đã sẵn sàng báo cáo lỗi, hãy truy cập [trang vấn đề](https://github.com/RooVetGit/Roo-Code/issues/new/choose) của chúng tôi, nơi bạn sẽ tìm thấy một mẫu để giúp bạn điền thông tin liên quan.

<blockquote class='warning-note'>
     🔐 <b>Quan trọng:</b> Nếu bạn phát hiện lỗ hổng bảo mật, vui lòng sử dụng <a href="https://github.com/RooVetGit/Roo-Code/security/advisories/new">công cụ bảo mật Github để báo cáo riêng tư</a>.
</blockquote>

## Quyết Định Làm Việc trên Cái Gì

Tìm kiếm đóng góp đầu tiên tốt? Kiểm tra các vấn đề trong phần "Issue [Unassigned]" của [Dự án Github Roo Code](https://github.com/orgs/RooVetGit/projects/1) của chúng tôi. Những vấn đề này được chọn lọc đặc biệt cho người đóng góp mới và các lĩnh vực mà chúng tôi muốn nhận được sự giúp đỡ!

Chúng tôi cũng hoan nghênh đóng góp cho [tài liệu](https://docs.roocode.com/) của chúng tôi! Dù là sửa lỗi chính tả, cải thiện hướng dẫn hiện có, hay tạo nội dung giáo dục mới - chúng tôi muốn xây dựng một kho tài nguyên do cộng đồng thúc đẩy giúp mọi người tận dụng tối đa Roo Code. Bạn có thể nhấp vào "Edit this page" trên bất kỳ trang nào để nhanh chóng đến đúng vị trí trong Github để chỉnh sửa tệp, hoặc bạn có thể đi trực tiếp vào https://github.com/RooVetGit/Roo-Code-Docs.

Nếu bạn đang lên kế hoạch làm việc trên một tính năng lớn hơn, vui lòng tạo [yêu cầu tính năng](https://github.com/RooVetGit/Roo-Code/discussions/categories/feature-requests?discussions_q=is%3Aopen+category%3A%22Feature+Requests%22+sort%3Atop) trước để chúng tôi có thể thảo luận xem nó có phù hợp với tầm nhìn của Roo Code không.

## Thiết Lập Phát Triển

1. **Clone** kho lưu trữ:

```sh
git clone https://github.com/RooVetGit/Roo-Code.git
```

2. **Cài đặt các phụ thuộc**:

```sh
npm run install:all
```

3. **Khởi động webview (ứng dụng Vite/React với HMR)**:

```sh
npm run dev
```

4. **Gỡ lỗi**:
   Nhấn `F5` (hoặc **Run** → **Start Debugging**) trong VSCode để mở phiên mới với Roo Code được tải.

Các thay đổi đối với webview sẽ xuất hiện ngay lập tức. Các thay đổi đối với phần mở rộng cốt lõi sẽ yêu cầu khởi động lại máy chủ phần mở rộng.

Hoặc bạn có thể xây dựng một tệp .vsix và cài đặt nó trực tiếp trong VSCode:

```sh
npm run build
```

Một tệp `.vsix` sẽ xuất hiện trong thư mục `bin/` có thể được cài đặt bằng:

```sh
code --install-extension bin/roo-cline-<version>.vsix
```

## Viết và Gửi Mã

Bất kỳ ai cũng có thể đóng góp mã cho Roo Code, nhưng chúng tôi yêu cầu bạn tuân theo những hướng dẫn này để đảm bảo đóng góp của bạn có thể được tích hợp suôn sẻ:

1. **Giữ Pull Request Tập Trung**

    - Giới hạn PR vào một tính năng hoặc sửa lỗi duy nhất
    - Chia các thay đổi lớn hơn thành các PR nhỏ hơn, có liên quan
    - Chia các thay đổi thành các commit hợp lý có thể được xem xét độc lập

2. **Chất Lượng Mã**

    - Tất cả PR phải vượt qua kiểm tra CI bao gồm cả linting và định dạng
    - Giải quyết mọi cảnh báo hoặc lỗi ESLint trước khi gửi
    - Phản hồi tất cả phản hồi từ Ellipsis, công cụ đánh giá mã tự động của chúng tôi
    - Tuân theo các thực hành tốt nhất của TypeScript và duy trì an toàn kiểu

3. **Kiểm Tra**

    - Thêm kiểm tra cho các tính năng mới
    - Chạy `npm test` để đảm bảo tất cả các kiểm tra đều vượt qua
    - Cập nhật các bài kiểm tra hiện có nếu thay đổi của bạn ảnh hưởng đến chúng
    - Bao gồm cả kiểm tra đơn vị và kiểm tra tích hợp khi thích hợp

4. **Hướng Dẫn Commit**

    - Viết thông điệp commit rõ ràng, mô tả
    - Tham chiếu các vấn đề có liên quan trong commit bằng cách sử dụng #số-vấn-đề

5. **Trước Khi Gửi**

    - Rebase nhánh của bạn trên main mới nhất
    - Đảm bảo nhánh của bạn xây dựng thành công
    - Kiểm tra lại rằng tất cả các bài kiểm tra đều vượt qua
    - Xem xét các thay đổi của bạn cho bất kỳ mã gỡ lỗi hoặc bản ghi console nào

6. **Mô Tả Pull Request**
    - Mô tả rõ ràng những gì thay đổi của bạn làm
    - Bao gồm các bước để kiểm tra các thay đổi
    - Liệt kê bất kỳ thay đổi đáng kể nào
    - Thêm ảnh chụp màn hình cho các thay đổi UI

## Thỏa Thuận Đóng Góp

Bằng cách gửi một pull request, bạn đồng ý rằng đóng góp của bạn sẽ được cấp phép theo cùng giấy phép với dự án ([Apache 2.0](../LICENSE)).
