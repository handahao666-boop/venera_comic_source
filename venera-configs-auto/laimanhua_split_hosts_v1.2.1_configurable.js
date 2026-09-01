// 来漫画 (laimanhua88.com / laimanhuaba.com) - Venera 漫画源
// 来漫画单源可配置分流版：搜索与主页分类可分别选择网址，搜索无封面但可用
// 版本：1.2.1-configurable


// GB2312 decode table: 8178 entries (87 zones x 94 positions), base64 len 21808
const GB2312_TABLE_B64 = "ADABMAIw+zDJAscCqAADMAUwFSBe/xYgJiAYIBkgHCAdIBQwFTAIMAkwCjALMAwwDTAOMA8wFjAXMBAw" +
  "ETCxANcA9wA2IiciKCIRIg8iKiIpIggiNyIaIqUiJSIgIhIjmSIrIi4iYSJMIkgiPSIdImAibiJvImQi" +
  "ZSIeIjUiNCJCJkAmsAAyIDMgAyEE/6QA4P/h/zAgpwAWIQYmBSbLJc8lziXHJcYloSWgJbMlsiU7IJIh" +
  "kCGRIZMhEzD9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9/4gkiSSKJIskjCSNJI4kjySQJJEk" +
  "kiSTJJQklSSWJJckmCSZJJokmyR0JHUkdiR3JHgkeSR6JHskfCR9JH4kfySAJIEkgiSDJIQkhSSGJIck" +
  "YCRhJGIkYyRkJGUkZiRnJGgkaST9//3/IDIhMiIyIzIkMiUyJjInMigyKTL9//3/YCFhIWIhYyFkIWUh" +
  "ZiFnIWghaSFqIWsh/f/9/wH/Av8D/+X/Bf8G/wf/CP8J/wr/C/8M/w3/Dv8P/xD/Ef8S/xP/FP8V/xb/" +
  "F/8Y/xn/Gv8b/xz/Hf8e/x//IP8h/yL/I/8k/yX/Jv8n/yj/Kf8q/yv/LP8t/y7/L/8w/zH/Mv8z/zT/" +
  "Nf82/zf/OP85/zr/O/88/z3/Pv8//0D/Qf9C/0P/RP9F/0b/R/9I/0n/Sv9L/0z/Tf9O/0//UP9R/1L/" +
  "U/9U/1X/Vv9X/1j/Wf9a/1v/XP9d/+P/QTBCMEMwRDBFMEYwRzBIMEkwSjBLMEwwTTBOME8wUDBRMFIw" +
  "UzBUMFUwVjBXMFgwWTBaMFswXDBdMF4wXzBgMGEwYjBjMGQwZTBmMGcwaDBpMGowazBsMG0wbjBvMHAw" +
  "cTByMHMwdDB1MHYwdzB4MHkwejB7MHwwfTB+MH8wgDCBMIIwgzCEMIUwhjCHMIgwiTCKMIswjDCNMI4w" +
  "jzCQMJEwkjCTMP3//f/9//3//f/9//3//f/9//3//f+hMKIwozCkMKUwpjCnMKgwqTCqMKswrDCtMK4w" +
  "rzCwMLEwsjCzMLQwtTC2MLcwuDC5MLowuzC8ML0wvjC/MMAwwTDCMMMwxDDFMMYwxzDIMMkwyjDLMMww" +
  "zTDOMM8w0DDRMNIw0zDUMNUw1jDXMNgw2TDaMNsw3DDdMN4w3zDgMOEw4jDjMOQw5TDmMOcw6DDpMOow" +
  "6zDsMO0w7jDvMPAw8TDyMPMw9DD1MPYw/f/9//3//f/9//3//f/9/5EDkgOTA5QDlQOWA5cDmAOZA5oD" +
  "mwOcA50DngOfA6ADoQOjA6QDpQOmA6cDqAOpA/3//f/9//3//f/9//3//f+xA7IDswO0A7UDtgO3A7gD" +
  "uQO6A7sDvAO9A74DvwPAA8EDwwPEA8UDxgPHA8gDyQP9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/EAQRBBIEEwQUBBUE" +
  "AQQWBBcEGAQZBBoEGwQcBB0EHgQfBCAEIQQiBCMEJAQlBCYEJwQoBCkEKgQrBCwELQQuBC8E/f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3/MAQxBDIEMwQ0BDUEUQQ2BDcEOAQ5BDoEOwQ8BD0EPgQ/BEAE" +
  "QQRCBEMERARFBEYERwRIBEkESgRLBEwETQROBE8E/f/9//3//f/9//3//f/9//3//f/9//3//f8BAeEA" +
  "zgHgABMB6QAbAegAKwHtANAB7ABNAfMA0gHyAGsB+gDUAfkA1gHYAdoB3AH8AOoA/f/9//3//f/9//3/" +
  "/f/9//3//f8FMQYxBzEIMQkxCjELMQwxDTEOMQ8xEDERMRIxEzEUMRUxFjEXMRgxGTEaMRsxHDEdMR4x" +
  "HzEgMSExIjEjMSQxJTEmMScxKDEpMf3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9/wAlASUCJQMlBCUFJQYlByUIJQklCiULJQwlDSUOJQ8lECURJRIlEyUUJRUlFiUXJRgl" +
  "GSUaJRslHCUdJR4lHyUgJSElIiUjJSQlJSUmJSclKCUpJSolKyUsJS0lLiUvJTAlMSUyJTMlNCU1JTYl" +
  "NyU4JTklOiU7JTwlPSU+JT8lQCVBJUIlQyVEJUUlRiVHJUglSSVKJUsl/f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "/f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3/" +
  "SlU/lsNXKGPOVAlVwFSRdkx2PIXud36CjXgxcpiWjZcobIlb+k8JY5dmuFz6gEhoroACZs52+VFWZaxx" +
  "8X+EiLJQZVnKYbNvrYJMY1Ji7VMnVAZ7a1GkdfRd1GLLjXaXimIZgF1XOJdifzhyfXbPZ352RmRwTyWN" +
  "3GIXepFl7XMsZHNiLIKBmH9nSHJuYsxiNE/jdEpTnlLKfqaQLl6GaJxpgIHRftJoxXiMhlGVjVAkjN6C" +
  "3oAFUxKJZVKEhfmW3U8hWHGZnVuxYqVitGZ5jI2cBnJvZ5F4smBRUxdTiI/MgB2NoZQNUMhyB1nrYBlx" +
  "q4hUWe+CLGcoeyld934tdfVsZo74jzyQO5/UaxmRFHt8X6d41oQ9hdVr2WvWawFeh175de2VXWUKX8Vf" +
  "n4/BWMKBf5Bblq2XuY8WfyyNQWK/T9hTXlOoj6mPq49NkAdoal+YgWiI1pyLYStSKnZsX4xl0m/obr5b" +
  "SGR1UbBRxGcZTsl5fJmzcMV1dl67c+CDrWToYrWU4mxaU8NSD2TClJR7L08bXjaCFoGKgSRuymxzmlVj" +
  "XFP6VGWI4FcNTgNeZWs/fOiQFmDmZBxzwYhQZ01iIo1sdymOx5FpX9yDIYUQmcJTlYaLa+1g6GB/cM2C" +
  "MYLTTqdsz4XNZNl8/Wn5ZkmDlVNWe6dPjFFLbUJcbY7SY8lTLIM2g+VntHg9ZN9blFzuXeeLxmL0Z3qM" +
  "AGS6Y0mHi5kXjCB/8pSnThCWpJgMZhZzOlcdXDhef5V/UKCAglNeZUV1MVUhUIWNhGKelB1nMlZub+Jd" +
  "NVSScGaPb2KkZKNje1+Ib/SQ44GwjxhcaGbxX4lsSJaBjWyIkWTwec5XWWoQYkhUWE4LeulghG/ai39i" +
  "HpCLmuR5A1T0dQFjGVNgbN+PG19wmjuAf5+ITzpcZI3Ff6VlvXBFUbJRa4YHXaBbvWJskXR1DI4gegFh" +
  "eXvHTvh+hXcRTu2BHVL6UXFqqFOHjgSVz5bBbmSWWmlAeKhQ13cQZOaJBFnjY91df3o9aSBPOYKYVTJO" +
  "rnWXemJeil7vlRtSOVSKcHZjJJWCVyVmP2mHkQdV822vfiKIM2LwfrV1KIPBeMyWno9IYfd0zYtkazpS" +
  "UI0ha2qAcYTxVgZTzk4bTtFRl3yLkQd8w09/juF7nHpnZBRdrFAGgQF2uXzsbeB/UWdYW/hby3iuZBNk" +
  "qmMrYxmVLWS+j1R7KXZTYidZRlR5a6NQNGImXoZr4043jYuIhV8ukCBgPYDFYjlOVVP4kLhjxoDmZS5s" +
  "Rk/uYOFt3os5X8uGU18hY1pRYYNjaABSY2NIjhJQm1x3efxbMFI7erxgU5DXdrdfl1+EdmyOb3B7dkl7" +
  "qnfzUZOQJFhOT/Ru6o9MZRt7xHKkbd9/4Vq1YpVeMFeChCx7HV4fXxKQFH+gmIJjx26YeLlweFFbl6tX" +
  "NXVDTzh1l17mYGBZwG2/a4l4/FPVlstRAVKJYwpUk5QDjMyNOXKfeHaH7Y8NjOBTAU7vdu5TiZR2mA6f" +
  "LZWaW6KLIk4cTqxRY4TCYahSC2iXT2tgu1EebVxRlmKXZWGWRowXkNh1/ZBjd9JrinLscvuLNVh5d0yN" +
  "XGdAlZqApl4hbpJZ73rtdzuVtWutZQ5/BlhRUR+W+VupWChUco5mZX+Y5FadlP52QZCHY8ZUGlk6WZtX" +
  "so41Z/qNNYJBUvBgFVj+huhcRZ7ET52YuYslWnZghFN8Yk+QApF/mWlgDIA/UTOAFFx1mTFtjE4wjdFT" +
  "Wn9PexBPT04AltVs0HPphQZeanX7fwpq/neSlEF+4VHmcM1T1I8DgymNr3JtmdtsSlezgrllqoA/YjKW" +
  "qFn/Tr+Lun4+ZfKDXpdhVd6YpYAqU/2LIFS6gJ9euGw5jayCWpEpVBtsBlK3fl9XGnF+bIl8S1n9Tv9f" +
  "JGGqfDBOAVyrZwKH8FwLlc6Yr3X9cCKQr1Edf72LSVnkUVtPJlQrWXdlpIB1W3ZiwmKQj0VeH2wmew9P" +
  "2E8NZ25tqm2PebGIF18rdZpihY/vT9yRp2UvgVGBnF5QgXSNb1KGiUuNDVmFUNhOHJY2cnmBH43MW6OL" +
  "RJaHWRp/kFR2Vg5W5Ys5ZYJpmZTWdolucl4YdUZn0Wf/ep2Ado0fYcZ5YmVjjYhRGlKilDh/m4Cyfpdc" +
  "L25gZ9l7i3bYmo+BlH/VfB5kUJU/ekpU5VRMawFkCGI9nvOAmXVyUmmXW4Q8aOSGAZaUluyUKk4EVNl+" +
  "OWjfjRWA9GaaXrl/wlc/gJdo5V07ZZ9SbWCan5tPrI5sUatbE1/pXV5s8WIhjXFRqZT+Up9s34LXcqJX" +
  "hGctjR9ZnI/Hg5VUjXswT71sZFvRWROf5FPKhqiaN4yhgEVlfpj6VseWLlLcdFBS4VsCYwKJVk7QYipg" +
  "+mhzUZhboFHCiaF7hplQf+9gTHAvjUlRf14bkHB0xIktV0V4Ul+fn/qVaI88m+GLeHZCaNxn6o01jT1S" +
  "io/abs1oBZXtkP1WnGf5iMePyFS4mmlbd20mbKVOs1uHmmORqGGvkOmXK1S1bdJb/VGKVVV/8H+8ZE1j" +
  "8WW+YY1gCnFXbElsL1ltZyqC1ViOVmqM62vdkH1ZF4D3U2ltdVSdVXeDz4M4aL55jFRVTwhU0naJjAKW" +
  "s2y4bWuNEIlknjqNP1bRntV1iF/gcmhg/FSoTipqYYhSYHCPxFTYcHmGP54qbY9bGF+ifolVr080czxU" +
  "mlMZUA5UfFROTv1fWnT2WGuE4YB0h9ByynxWbidfToYsVaRikk6qbDdisYLXVE5TPnPRbjt1ElIWU92L" +
  "0GmKXwBg7m1PVyJrr3NTaNiPE39iY6NgJFXqdWKMFXGjbaZbe15Sg0xhxJ76eFeHJ3yHdvBR9mBMcUNm" +
  "TF5NYA6McHAlY4mPvV9iYNSG3lbBa5RgZ2FJU+BgZmY/jf15Gk/pcEdss4vyi9h+ZIMPZlpaQptRbfdt" +
  "QYw7bRlPa3C3gxZi0WANlyeNeHn7UT5X+lc6Z3h1PXrveZV7jIBlmfmPwG+liyGe7Fnpfgl/CVSBZ9ho" +
  "kY9NfMaWylMlYL51cmxzU8lap34kY+BRCoHxXd+EgGKAUWNbDk9teUJSuGBObcRbwluhi7CL4mXMX0WW" +
  "k1nnfqp+CVa3ZzlZc0+2W6BSWoOKmD6NMnW+lEdQPHr3TrZnfprBWnxr0XZaVxZcOnv0lU5xfFGpgHCC" +
  "eFkEfyeDwGjsZ7F4d3jjYmFjgHvtT2pSz1FQg9tpdJL1jTGNwYkula179k5lUDCCUVJvmRBuhW6nbfpe" +
  "9VDcWQZcRm1fbIZ1i4RoaFZZsosgU3GRTZZJhRJpAXkmcfaApE7KkEdthJoHWrxWBWTwlOt3pU8ageFy" +
  "0ol6mTR/3n5/UllldZF/j4OP61OWeu1jpWOGdvh5V4g2lipiq1KCglRocGd3Y2t37XoBbdN+44nQWRJi" +
  "yYWlgkx1H1DLTqV164tKXP5dS3ukZdGRyk4lbV+JJ30mlcVOKIzbj3OXS2aBedGP7HB4bT1cslJGg2JR" +
  "DoNbd3ZmuJysTspgvnyzfM9+lU5mi29miJhZl4NYbGVclYRfyXVWl9963nrAUa9wmHrqY3Z6oH6Wc+2X" +
  "RU54cF1OUpGpU1Fl52X8gQWCjlQxXJp1oJfYYtlyvXVFXHmayoNAXIBU6Xc+Tq5sWoDSYm5j6F13Ud2N" +
  "Ho4vlfFP5VPnYKxwZ1JQY0OeH1omUDd3d1PifoVkK2WJYphjFFA1csmJs1HAi91+R1fMg6eUm1EbVPtc" +
  "yk/jelpt4ZCPmoBVllRhU69UAF/pY3dp71FoYQpSKljYUk5XDXgLd7ded2HgfFtil2KiTpVwA4D3YuRw" +
  "YJd3V9uC72f1aNV4l5jRefNYs1TvUzRuS1E7UqJb/ouvgENVpldzYFFXLVR6elBgVFunY6Bi41NjYsdb" +
  "r2ftVJ965oJ3kZNe5Ig4Wa5XDmPoje+AV1d3e6lP61+9Wz5rIVNQe8JyRmj/dzZ392W1UY9O1Ha/XKV6" +
  "dYROWUGbgFCImSdhg25kVwZmRmPwVuxiaWLTXhSWg1fJYodVIYdKgaOPZlWxg2VnVo3dhGpaD2jmYu57" +
  "EZZwUZxvMIz9Y8iJ0mEGf8Jw5W4FdJRp/HLKXs6QF2dqbV5js1JicgGAbE/lWWqR2XCdbdJSUE73lm2V" +
  "foXKeC99IVGSV8Jki4B7fOps8WheabdRmFOoaIFyzp7xe/hyu3kTbwZ0TmfMkaScPHmJg1SDD1QXaD1O" +
  "iVOxUj54hlMpUohQi0/QT+J1y3qSfKVstpabUoN06VTpT1SAsoPej3CVyV4cYJ9tGF5bZTiB/pRLYLxw" +
  "w36ufMlRgWixfG+CJE6Gj8+RfmauTgWMqWRKgNpQl3XOceVbvY9mb4ZOgmRjldZemWUXUsKIyHCjUg5z" +
  "M3SXZ/d4Fpc0TruQ3pzLbdtRQY0dVM5isnPxg/aWhJ/DlDZPmn/MUXVwdZatXIaY5lPkTpxuCXS0aWt4" +
  "j5lZdRhSJHZBbfNnbVGZn0uAmVQ8e796hpaEV+JiR5Z8aQRaAmTTew9vS5amgmJThZiQXolws2NkU0+G" +
  "gZyTnox4MpfvjUKNf55eb4R5VV9Gli5idJoVVN2Uo0/FZWVcYVwVf1GGL2yLX4dz5G7/fuZcG2NqW+Zu" +
  "dVNxTqBjZXWhYm6PJk/RTqZstn66ix2EuodXfzuQI5Wpe6Ga+Ig9hBtthprcfohZu56bcwF4goZsmoKa" +
  "G1YXVMtXcE6mnlZTyI8JgZJ3kpnuhuFuE4X8ZmJhK28pjJKCK4PydhNs2V+9gytzBYMaldtr23fGlG9T" +
  "AoOSUT1ejIw4jUhOq3OaZ4VodpEJl2RxoWwJd5JaQZXPa45/J2bQW7lZmlrolfeV7E4MhJmErGrfdjCV" +
  "G3OmaF9bL3eakWGX3Hz3jxyMJV9zfNh5xYnMbByHxltCXsloIHf1fpVRTVHJUilaBX9il9eCz2OEd9CF" +
  "0nk6bplemVkRhW1wEWy/Yr92T2WvYP2VDmafhyOe7ZQNVH1ULIx4ZHlkEYYhapyB6HhpZFSbuWIrZ6uD" +
  "qFjYnqtsIG/eW0yWC4xfctBnx2JhcqlOxlnNa5NYrmZVXt9SVWEoZ+52ZndnckZ6/2LqVFBUoJSjkBxa" +
  "s34WbENOdlkQgEhZV1M3db6WylYgYxGBfGD5ldZtYlSBmYVR6Vr9gK5ZE5cqUOVsPFzfYmBPP1N7gQaQ" +
  "um4rhchidF6+eLVke2P1Xxhaf5Efnj9cT2NCgH1bblVKlU2VhW2oYOBn3nLdUYFb52LebFtybWKulL1+" +
  "E4FTbZxRBF90WapSEmBzWZZmUIafdSpj5mHvfPqL5lQnayWetGvVhVVUdlCkbGpVtI0schVeFWA2dM1i" +
  "kmNMcphfQ24+bQBlWG/YdtB4/HZUdSRS21NTTp5ewWUqgNaAm2KGVChSrnCNiNGN4Wx4VNqA+Vf0iFSN" +
  "apZNkWlPm2y3VcZ2MHioYvlwjm9tX+yE2mh8ePd7qIELZ0+eZ2OweG9XEng5l3liq2KIUjV012tkVT6B" +
  "snWudjlT3nX7UEFcbIvHe09QR3KXmtiYAm/idGh5h2Sld/xikZgrjcFUWIBSTmpX+YINhHNe7VH2dMSL" +
  "T1xhV/xsh5hGWjR4RJvrj5V8VlJRYvqUxk6Gg2GE6YOyhNRXNGcDV25mZm0xjN1mEXAfZzprFmgaYrtZ" +
  "A07EUQZv0mePbHZRy2hHWWdrZnUOXRCBUJ/XZUh5QXmRmneNglxeTgFPL1RRWQx4aFYUbMSPA199bONs" +
  "q4uQY3BgPW11cmZijpTFlENTwY9+e99OJox+TtSesZSzlE1SXG9jkEVtNIwRWExdIGtJa6pnW1RUgYx/" +
  "mVg3hTpfomJHajmVcmWEYGVop3dUTqhP512Yl6xk2H/tXM9PjXoHUgSDFE4vYIN6ppS1T7JO5nk0dORS" +
  "uYLSZL153VuBbFKXe48ibD5Qf1MFbs5kdGYwbMVgd5j3i4ZePHR3est5GE6xkAN0QmzaVkuRxWyLjTpT" +
  "xobyZq+OSFxxmiBu1lM2Woufo427UwhXp5hDZ5uRyWxoUcp182KscjhSnVI6f5RwOHZ0U0qet2lueMCW" +
  "2YikfzZxw3GJUdNn5HTkWBhlt1api3aZcGLVfvlg7XDsWMFOuk7NX+eX+06kiwNSilmrflRizU7lZQ5i" +
  "OIPJhGODjYeUcbZuuVvSfpdRyWPUZ4mAOYMViBJReluCWbGPc05dbGVRJYlvjy6WSoVedBCV8JWmbeWC" +
  "MV+SZBJtKIRugcOcXlhbjQlOwVMeT2NlUWjTVSdOFGSammtiwlpfdHKCqW3uaOdQjoMCeEBnOVKZbLF+" +
  "u1BlVV5xW3tSZspz64JJZ3FcIFJ9cWuI6pVVlsVkYY2zgYRVVWxHYi5/klgkT0ZVT41MZgpOGlzziKJo" +
  "TmMNeudwjYL6UvaXEVzoVLWQzX5iWUqNx4YMgg2CZo1EZARcUWGJbT55vos3eDN1e1Q4T6uO8W0gWsV+" +
  "XnmIbKFbdloadb6ATmEXbvBYH3UldXJyR1PzfgF323ZpUtyAI1cIXjFZ7nK9ZX9u14s4XHGGQVPzd/5i" +
  "9mXATt+YgIaeW8aL8lPid39PTlx2mstZD186eetYFk7/Z4tO7WKTih2Qv1IvZtxVbFYCkNVOjU/KkXCZ" +
  "D2wCXkNgpFvGidWLNmVLYpaZiFv/W4hjLlXXUyZ2fVEshaJns2iKa5Jik4/UUxKC0W2PdWZOTo1wW59x" +
  "r4WRZtlmcn8Ah82eIJ9eXC9n8I8RaF9nDWLWeoVYtl5wZTFvVWA3Ug2AVGRwiCl1BV4TaPRiHJfMUz1y" +
  "AYw0bGF3DnouVKx3epgcgvSLVXgUZ8Fwr2WVZDZWHWDBefhTHU57a4aA+lvjVdtWOk88T3KZ811+ZziA" +
  "AmCCmAGQi1u8i/WLHGRYgt5k/VXPgmWR108gfR+Qn3zzUFFYr26/W8mLg4B4kZyEl3t9houWj5blftOa" +
  "jniBXFd6QpCnll95WVtfYwt70YStaAZVKX8QdCJ9AZVAYkxY1k6DW3lZVFhtcx5jS44Pjs6A1IKsYvBT" +
  "8GxekSpZAWBwbE1XSmQqjSt26W5bV4Bq8HVtby2MCIxmV+9rkoizeKJj+VOtcGRsWFgqZAJY4GibgRBV" +
  "1nwYULqOzG2fjetwj2ObbdRu5n4EhENoA5DYbXaWqItXWXly5IV+gbx1ioqvaFRSIo4RldBjmJhEjnxV" +
  "U0//Zo9W1WCVbUNSSVwpWftta1gwdRx1bGAUgkaBEWNhZ+KPOnfzjTSNwZQWXoVTLFTDcEBs915cUK1O" +
  "rV46Y0eCGpBQaG6Rs3cMVNyUZF/lenZoRWNSe99+23V3UJViNFkPkPhRw3mBev5Wkl8UkIJtYFwfVxBU" +
  "VFFNbuJWqGOTmH+BFYcqiQCQHlRvXMCB1mJYYjGBNZ5Alm6afJotaaVZ02I+VRZjx1TZhjxtA1rmdJyI" +
  "amsWWUyML19+bqlzfZg4TvdwjFuXeD1jWmaWdstgm1tJWgdOVYFqbItzoU6JZ1F/gF/6ZRtn2F+EWQFa" +
  "zV2uX3FT5pfdj0Vo9FYvVd9gOk5Nb/R+x4IOhNRZH08qTz5crH4qZxqFc1RPdcOAglVPm01PLW4TjAlc" +
  "cGFrUx92KW6Khodl+5W5fjtUM3oKfe6V4VXBf+50HWMXh6FtnXoRYqFlZ1PhY4Ns611cVKiUTE5hbOyL" +
  "S1zgZZyCp2g+VDRUy2tma5ROQmNIUx6CDU+uT15XCmL+lmRmaXL/UqFSn2DvixRmmXGQZ3+JUnj9d3Bm" +
  "O1Y4VCGVenIAem9gDF6JYJ2BFVncYIRx73CqblBsgHKEaq2ILV5gTrNanFXjlBdt+3yZlg9ixn6Od36G" +
  "I1Mel5aPh2bhXKBP7XILTqZTD1kTVIBjKJVIUdlOnJykfrhUJI1UiDeC8pWObSZfzFo+ZmmWsHMuc79T" +
  "eoGFmaF/qlt3llCWv374dqJTdpWZmbF7RIlYbmFO1H9leeaL82DNVKtOeZj3XWFqz1ARVGGMJ4RdeASX" +
  "SlLuVKNWAJWIbbVbxm1TZg9cXVshaJaAeFURe0hlVGmbTkdrToeLl09TH2M6ZKqQnGXBgBCMmVGwaHhT" +
  "+YfIYcRs+2wijFFcqoWvggyVI2ubj7Bl+1/DX+FPRYgfZmWBKXP6YHRREVKLV2JfopBMiJKReF5PZydg" +
  "01lEUfZR+IAIU3lsxJaKcRFP7k+efz1nxVUIlcB5lojjfp9YDGIAl1qGGFZ7mJBfuIvEhFeR2VPtZY9e" +
  "XHVkYG59f1rqfu1+aY+nVaNbrGDLZYRzCZBjdil32n50l5uFZlt0euqWQIjLUo9xql/sZeKL+1tvmuFd" +
  "iWtbbK2Lr4sKkMWPi1O8YiaeLZ5AVCtOvYJZcpyGFl1ZiK9txZbRVJpOtosJcb1UCZbfcPlt0HYlThR4" +
  "EoepXPZeAIqcmA6WjnC/bERZqWM8d02IFG9zgjBY1XGMUxp4wZYBVWZfMHG0WxqMjJqDay5ZL57neWhn" +
  "bGJvT6F1in8LbTOWJ2zwTtJ1e1E3aD5vgJBwgZZZdnRHZCdcZZCReiOM2lmsVACCb4OBiQCAMGlOVjaA" +
  "N3LOkbZRX051mJZjGk72U/NmS4EcWbJtAE75WDtT1mPxlJ1PCk9jiJCYN1lXkPt56k7wgJF1gmycW+hZ" +
  "XV8FaYGGGlDyXVlO43flTnqCkWITZpGQeVy/TnlfxoE4kISAq3WmTtSID2HFa8ZfSU7KdqJu44uuiwqM" +
  "0YsCX/x/zH/OfjWDa4PgVrdr85c0lvtZH1T2lOttxVtumTlcFV+QlnBT8YIxanRacJ6UXih/uYMkhCWE" +
  "Z4NHh86PYo3IdnFflphseCBm31TlYmNPw4HIdbhezZYKjvmGj1TzbIxtOGx/YMdSKHV9XhhPoGDnXyRc" +
  "MXWukMCUuXK5bDhuSZEJZ8tT81NRT8mR8YvIU3xewo/kbY5OwnaGaV6GGmEGgllP3k8+kHycCWEdbhRu" +
  "hZaITjFa6JYOTn9cuXmHW+2LvX+Jc99Xi4LBkAFUR5C7VepcoV8IYTJr8XKygImKdG3TW9WIhJhrjG2a" +
  "M54KbqRRQ1GjV4GIn1P0Y5WP7VZYVAZXP3OQbhh/3I/Rgj9hKGBilvBmpn6KjcONpZSzXKR8CGemYAWW" +
  "GICRTueQAFNolkFR0I90hV2RVWb1l1VbHVM4eEJnPWjJVH5wsFt9j41RKFexVBJlgmZejUOND4FshG2Q" +
  "33z/UfuFo2fpZaFvpIaBjmpWIJCCdnZw5XEjjeliGVL9bDyNDmCeWI5h/mZgjU5is1Ujbi1nZ4/hlPiV" +
  "KHcFaKhpi1RNTrhwyItYZItlhVuEejpQ6Fu7d+FreYqYfL5sz3apZZePLV1VXDiGCGhgUxhi2Xpbbv1+" +
  "H2rgenBfM28gX4xjqG1WZwhOEF4mjddOwIA0dpyW22ItZn5ivGx1jWdxaX9GUYeA7FNukJhi8lTwhpmP" +
  "BYAXlReF2Y9Zbc1zn2UfdwR1J3j7gR6NiJSmT5VnuXXKiweXL2NHlTWWuIQjY0F3gV/wcolOFGB0Ze9i" +
  "Y2s/ZSdex3XRkMGLnYKdZy9lMVQYh+V3ooACgUFsS07HfkyA9HYNaZZrZ2I8UIRPQFcHY2Jrvo3qU+hl" +
  "uH7XXxpjt2PzgfSBbn8cXtlcNlJ6Zul5GnoojZlw1HXebrtsknotTsV24F+flHeIyH7Neb+AzZHyThdP" +
  "H4JoVN5dMm3Mi6V8dI+YgBpeklSxdplbPGakmuBzKmjbhjFnKnP4i9uLEJD5ettwbnHEYql3MVY7TleE" +
  "8WepUsCGLo34lFF7T0/obF15e5qTYipy/WITThZ4bI+wZFqNxntpaIRexYiGWZ5k7li2cg5pJZX9j1iN" +
  "YFcAfwaMxlFJY9liU1NMaCJ0AYNMkURVQHd8cEpteVGoVESN/1nLbsRtXFsrfdROfXzTblBb6oENbldb" +
  "A5vVaCqOl1v8fjtgtX65kHCNT1nNY995s41SU89lVnnFizuWxH67lIJ+NFaJkQBnan8KXHWQKGbmXVBP" +
  "3mdaUFxPUFenXv3//f/9//3//f+NTgxOQFEQTv9eRVMVTphOHk4ym2xbaVYoTrp5P04VU0dOLVk7cm5T" +
  "EGzfVuSAl5nTa353F582Tp9OEJ9cTmlOk06IgltbbFUPVsROjVOdU6NTpVOuU2WXXY0aU/VTJlMuUz5T" +
  "XI1mU2NTAlIIUg5SLVIzUj9SQFJMUl5SYVJcUq+EfVKCUoFSkFKTUoJRVH+7TsNOyU7CTuhO4U7rTt5O" +
  "G0/zTiJPZE/1TiVPJ08JTytPXk9nTzhlWk9dT19PV08yTz1Pdk90T5FPiU+DT49Pfk97T6pPfE+sT5RP" +
  "5k/oT+pPxU/aT+NP3E/RT99P+E8pUExQ808sUA9QLlAtUP5PHFAMUCVQKFB+UENQVVBIUE5QbFB7UKVQ" +
  "p1CpULpQ1lAGUe1Q7FDmUO5QB1ELUd1OPWxYT2VPzk+gn0ZsdHxuUf1dyZ6YmYFRFFn5Ug1TB4oQU+tR" +
  "GVlVUaBOVlGzTm6IpIi1ThSB0oiAeTRbA4i4f6tRsVG9UbxRx1GWUaJRpVGgi6aLp4uqi7SLtYu3i8KL" +
  "w4vLi8+LzovSi9OL1IvWi9iL2Yvci9+L4Ivki+iL6Yvui/CL84v2i/mL/Iv/iwCMAowEjAeMDIwPjBGM" +
  "EowUjBWMFowZjBuMGIwdjB+MIIwhjCWMJ4wqjCuMLowvjDKMM4w1jDaMaVN6Ux2WIpYhljGWKpY9ljyW" +
  "QpZJllSWX5ZnlmyWcpZ0loiWjZaXlrCWl5CbkJ2QmZCskKGQtJCzkLaQupC4kLCQz5DFkL6Q0JDEkMeQ" +
  "05DmkOKQ3JDXkNuQ65DvkP6QBJEikR6RI5ExkS+ROZFDkUaRDVJCWaJSrFKtUr5S/1TQUtZS8FLfU+5x" +
  "zXf0XvVR/FEvm7ZTAV9ade9dTFepV6FXfli8WMVY0VgpVyxXKlczVzlXLlcvV1xXO1dCV2lXhVdrV4ZX" +
  "fFd7V2hXbVd2V3NXrVekV4xXslfPV6dXtFeTV6BX1VfYV9pX2VfSV7hX9FfvV/hX5FfdVwtYDVj9V+1X" +
  "AFgeWBlYRFggWGVYbFiBWIlYmliAWKiZGZ//YXmCfYJ/go+CioKogoSCjoKRgpeCmYKrgriCvoKwgsiC" +
  "yoLjgpiCt4KugsuCzILBgqmCtIKhgqqCn4LEgs6CpILhggmD94Lkgg+DB4PcgvSC0oLYggyD+4LTghGD" +
  "GoMGgxSDFYPggtWCHINRg1uDXIMIg5KDPIM0gzGDm4Negy+DT4NHg0ODX4NAgxeDYIMtgzqDM4Nmg2WD" +
  "aIMbg2mDbINqg22DboOwg3iDs4O0g6CDqoOTg5yDhYN8g7aDqYN9g7iDe4OYg56DqIO6g7yDwYMBhOWD" +
  "2IMHWBiEC4Tdg/2D1oMchDiEEYQGhNSD34MPhAOE+IP5g+qDxYPAgyaE8IPhg1yEUYRahFmEc4SHhIiE" +
  "eoSJhHiEPIRGhGmEdoSMhI6EMYRthMGEzYTQhOaEvYTThMqEv4S6hOCEoYS5hLSEl4TlhOOEDIUNdTiF" +
  "8IQ5hR+FOoVWhTuF/4T8hFmFSIVohWSFXoV6haJ3Q4VyhXuFpIWohYeFj4V5ha6FnIWFhbmFt4WwhdOF" +
  "wYXchf+FJ4YFhimGFoY8hv5eCF88WUFZN4BVWVpZWFkPUyJcJVwsXDRcTGJqYp9iu2LKYtpi12LuYiJj" +
  "9mI5Y0tjQ2OtY/ZjcWN6Y45jtGNtY6xjimNpY65jvGPyY/hj4GP/Y8Rj3mPOY1JkxmO+Y0VkQWQLZBtk" +
  "IGQMZCZkIWReZIRkbWSWZHpkt2S4ZJlkumTAZNBk12TkZOJkCWUlZS5lC1/SXxl1EV9fU/FT/VPpU+hT" +
  "+1MSVBZUBlRLVFJUU1RUVFZUQ1QhVFdUWVQjVDJUglSUVHdUcVRkVJpUm1SEVHZUZlSdVNBUrVTCVLRU" +
  "0lSnVKZU01TUVHJUo1TVVLtUv1TMVNlU2lTcVKlUqlSkVN1Uz1TeVBtV51QgVf1UFFXzVCJVI1UPVRFV" +
  "J1UqVWdVj1W1VUlVbVVBVVVVP1VQVTxVN1VWVXVVdlV3VTNVMFVcVYtV0lWDVbFVuVWIVYFVn1V+VdZV" +
  "kVV7Vd9VvVW+VZRVmVXqVfdVyVUfVtFV61XsVdRV5lXdVcRV71XlVfJV81XMVc1V6FX1VeRVlI8eVghW" +
  "DFYBViRWI1b+VQBWJ1YtVlhWOVZXVixWTVZiVllWXFZMVlRWhlZkVnFWa1Z7VnxWhVaTVq9W1FbXVt1W" +
  "4Vb1VutW+Vb/VgRXClcJVxxXD14ZXhReEV4xXjtePF43XkReVF5bXl5eYV6MXHpcjVyQXJZciFyYXJlc" +
  "kVyaXJxctVyiXL1crFyrXLFco1zBXLdcxFzSXORcy1zlXAJdA10nXSZdLl0kXR5dBl0bXVhdPl00XT1d" +
  "bF1bXW9dXV1rXUtdSl1pXXRdgl2ZXZ1dc4y3XcVdc193X4Jfh1+JX4xflV+ZX5xfqF+tX7VfvF9iiGFf" +
  "rXKwcrRyt3K4csNywXLOcs1y0nLocu9y6XLycvRy93IBc/NyA3P6cvtyF3MTcyFzCnMecx1zFXMiczlz" +
  "JXMsczhzMXNQc01zV3Ngc2xzb3N+cxuCJVnnmCRZAlljmWeZaJlpmWqZa5lsmXSZd5l9mYCZhJmHmYqZ" +
  "jZmQmZGZk5mUmZWZgF6RXotell6lXqBeuV61Xr5es15TjdJe0V7bXuhe6l66gcRfyV/WX89fA2DuXwRg" +
  "4V/kX/5fBWAGYOpf7V/4XxlgNWAmYBtgD2ANYClgK2AKYD9gIWB4YHlge2B6YEJgamB9YJZgmmCtYJ1g" +
  "g2CSYIxgm2DsYLtgsWDdYNhgxmDaYLRgIGEmYRVhI2H0YABhDmErYUphdWGsYZRhp2G3YdRh9WHdX7OW" +
  "6ZXrlfGV85X1lfaV/JX+lQOWBJYGlgiWCpYLlgyWDZYPlhKWFZYWlheWGZYalixOP3IVYjVsVGxcbEps" +
  "o2yFbJBslGyMbGhsaWx0bHZshmypbNBs1GytbPds+GzxbNdssmzgbNZs+mzrbO5ssWzTbO9s/mw5bSdt" +
  "DG1DbUhtB20EbRltDm0rbU1tLm01bRptT21SbVRtM22RbW9tnm2gbV5tk22UbVxtYG18bWNtGm7HbcVt" +
  "3m0Obr9t4G0RbuZt3W3ZbRZuq20Mbq5tK25ubk5ua26ybl9uhm5TblRuMm4lbkRu326xbphu4G4tb+Ju" +
  "pW6nbr1uu263btdutG7Pbo9uwm6fbmJvRm9HbyRvFW/5bi9vNm9Lb3RvKm8JbylviW+Nb4xveG9yb3xv" +
  "em/Rb8lvp2+5b7Zvwm/hb+5v3m/gb+9vGnAjcBtwOXA1cE9wXnCAW4RblVuTW6VbuFsvdZ6aNGTkW+5b" +
  "MInwW0eOB4u2j9OP1Y/lj+6P5I/pj+aP84/ojwWQBJALkCaQEZANkBaQIZA1kDaQLZAvkESQUZBSkFCQ" +
  "aJBYkGKQW5C5ZnSQfZCCkIiQg5CLkFBfV19WX1hfO1yrVFBcWVxxW2NcZly8fypfKV8tX3SCPF87m25c" +
  "gVmDWY1ZqVmqWaNZl1nKWatZnlmkWdJZslmvWddZvlkFWgZa3VkIWuNZ2Fn5WQxaCVoyWjRaEVojWhNa" +
  "QFpnWkpaVVo8WmJadVrsgKpam1p3WnpavlrrWrJa0lrUWrha4FrjWvFa1lrmWtha3FoJWxdbFlsyWzdb" +
  "QFsVXBxcWltlW3NbUVtTW2JbdZp3mniaepp/mn2agJqBmoWaiJqKmpCakpqTmpaamJqbmpyanZqfmqCa" +
  "opqjmqWap5qffqF+o36lfqh+qX6tfrB+vn7AfsF+wn7Jfst+zH7QftR+137bfuB+4X7ofut+7n7vfvF+" +
  "8n4Nf/Z++n77fv5+AX8CfwN/B38Ifwt/DH8PfxF/En8Xfxl/HH8bfx9/IX8ifyN/JH8lfyZ/J38qfyt/" +
  "LH8tfy9/MH8xfzJ/M381f3pef3XbXT51lZCOc5FzrnOic59zz3PCc9Fzt3Ozc8BzyXPIc+Vz2XN8mAp0" +
  "6XPnc95zunPycw90KnRbdCZ0JXQodDB0LnQsdBt0GnRBdFx0V3RVdFl0d3RtdH50nHSOdIB0gXSHdIt0" +
  "nnSodKl0kHSndNJ0unTql+uX7JdMZ1NnXmdIZ2lnpWeHZ2pnc2eYZ6dndWeoZ55nrWeLZ3dnfGfwZwlo" +
  "2GcKaOlnsGcMaNlntWfaZ7Nn3WcAaMNnuGfiZw5owWf9ZzJoM2hgaGFoTmhiaERoZGiDaB1oVWhmaEFo" +
  "Z2hAaD5oSmhJaClotWiPaHRod2iTaGtowmhuafxoH2kgafloJGnwaAtpAWlXaeNoEGlxaTlpYGlCaV1p" +
  "hGlraYBpmGl4aTRpzGmHaYhpzmmJaWZpY2l5aZtpp2m7aatprWnUabFpwWnKad9plWngaY1p/2kvau1p" +
  "F2oYamVq8mlEaj5qoGpQaltqNWqOanlqPWooalhqfGqRapBqqWqXaqtqN3NSc4FrgmuHa4RrkmuTa41r" +
  "mmuba6Frqmtrj22PcY9yj3OPdY92j3iPd495j3qPfI9+j4GPgo+Ej4ePi4+Nj46Pj4+Yj5qPzo4LYhdi" +
  "G2IfYiJiIWIlYiRiLGLnge909HT/dA91EXUTdTRl7mXvZfBlCmYZZnJnA2YVZgBmhXD3Zh1mNGYxZjZm" +
  "NWYGgF9mVGZBZk9mVmZhZldmd2aEZoxmp2adZr5m22bcZuZm6WYyjTONNo07jT2NQI1FjUaNSI1JjUeN" +
  "TY1VjVmNx4nKicuJzInOic+J0InRiW5yn3JdcmZyb3J+cn9yhHKLco1yj3KScghjMmOwYz9k2GQEgOpr" +
  "82v9a/Vr+WsFbAdsBmwNbBVsGGwZbBpsIWwpbCRsKmwybDVlVWVrZU1yUnJWcjByYoYWUp+AnICTgLyA" +
  "Cme9gLGAq4CtgLSAt4DngOiA6YDqgNuAwoDEgNmAzYDXgBBn3YDrgPGA9IDtgA2BDoHygPyAFWcSgVqM" +
  "NoEegSyBGIEygUiBTIFTgXSBWYFagXGBYIFpgXyBfYFtgWeBTVi1WoiBgoGRgdVuo4GqgcyBJmfKgbuB" +
  "wYGmgSRrN2s5a0NrRmtZa9GY0pjTmNWY2ZjamLNrQF/Ca/OJkGVRn5NlvGXGZcRlw2XMZc5l0mXWZYBw" +
  "nHCWcJ1wu3DAcLdwq3CxcOhwynAQcRNxFnEvcTFxc3FccWhxRXFycUpxeHF6cZhxs3G1cahxoHHgcdRx" +
  "53H5cR1yKHJscBhxZnG5cT5iPWJDYkhiSWI7eUB5RnlJeVt5XHlTeVp5YnlXeWB5b3lneXp5hXmKeZp5" +
  "p3mzedFf0F88YF1gWmBnYEFgWWBjYKtgBmENYV1hqWGdYcth0WEGYoCAf4CTbPZs/G32d/h3AHgJeBd4" +
  "GHgReKtlLXgceB14OXg6eDt4H3g8eCV4LHgjeCl4TnhteFZ4V3gmeFB4R3hMeGp4m3iTeJp4h3iceKF4" +
  "o3iyeLl4pXjUeNl4yXjsePJ4BXn0eBN5JHkeeTR5m5/5nvue/J7xdgR3DXf5dgd3CHcadyJ3GXctdyZ3" +
  "NXc4d1B3UXdHd0N3Wndod2J3ZXd/d413fXeAd4x3kXefd6B3sHe1d713OnVAdU51S3VIdVt1cnV5dYN1" +
  "WH9hf19/SIpof3R/cX95f4F/fn/NduV2MoiFlIaUh5SLlIqUjJSNlI+UkJSUlJeUlZSalJuUnJSjlKSU" +
  "q5SqlK2UrJSvlLCUspS0lLaUt5S4lLmUupS8lL2Uv5TElMiUyZTKlMuUzJTNlM6U0JTRlNKU1ZTWlNeU" +
  "2ZTYlNuU3pTflOCU4pTklOWU55TolOqU6ZTrlO6U75TzlPSU9ZT3lPmU/JT9lP+UA5UClQaVB5UJlQqV" +
  "DZUOlQ+VEpUTlRSVFZUWlRiVG5UdlR6VH5UilSqVK5UplSyVMZUylTSVNpU3lTiVPJU+lT+VQpU1lUSV" +
  "RZVGlUmVTJVOlU+VUpVTlVSVVpVXlViVWZVblV6VX5VdlWGVYpVklWWVZpVnlWiVaZVqlWuVbJVvlXGV" +
  "cpVzlTqV53fsd8mW1XnteeN563kGekddA3oCeh56FHo5ejd6UXrPnqWZcHqIdo52k3aZdqR23nTgdCx1" +
  "IJ4iniieKZ4qniueLJ4ynjGeNp44njeeOZ46nj6eQZ5CnkSeRp5HnkieSZ5LnkyeTp5RnlWeV55anlue" +
  "XJ5enmOeZp5nnmieaZ5qnmuebJ5xnm2ec56SdZR1lnWgdZ11rHWjdbN1tHW4dcR1sXWwdcN1wnXWdc11" +
  "43XodeZ15HXrded1A3bxdfx1/3UQdgB2BXYMdhd2CnYldhh2FXYZdht2PHYidiB2QHYtdjB2P3Y1dkN2" +
  "PnYzdk12XnZUdlx2VnZrdm92yn/menh6eXqAeoZ6iHqVeqZ6oHqseqh6rXqzemSIaYhyiH2If4iCiKKI" +
  "xoi3iLyIyYjiiM6I44jliPGIGon8iOiI/ojwiCGJGYkTiRuJCok0iSuJNolBiWaJe4mLdeWAsna0dtx3" +
  "EoAUgBaAHIAggCKAJYAmgCeAKYAogDGAC4A1gEOARoBNgFKAaYBxgIOJeJiAmIOYiZiMmI2Yj5iUmJqY" +
  "m5iemJ+YoZiimKWYpphNhlSGbIZuhn+GeoZ8hnuGqIaNhouGrIadhqeGo4aqhpOGqYa2hsSGtYbOhrCG" +
  "uoaxhq+GyYbPhrSG6YbxhvKG7YbzhtCGE4fehvSG34bYhtGGA4cHh/iGCIcKhw2HCYcjhzuHHoclhy6H" +
  "Goc+h0iHNIcxhymHN4c/h4KHIod9h36He4dgh3CHTIduh4uHU4djh3yHZIdZh2WHk4evh6iH0ofGh4iH" +
  "hYeth5eHg4erh+WHrIe1h7OHy4fTh72H0YfAh8qH24fqh+CH7ocWiBOI/ocKiBuIIYg5iDyINn9Cf0R/" +
  "RX8Qgvp6/XoIewN7BHsVewp7K3sPe0d7OHsqexl7LnsxeyB7JXskezN7Pnsee1h7WntFe3V7THtde2B7" +
  "bnt7e2J7cntxe5B7pnune7h7rHude6h7hXuqe5x7onure7R70XvBe8x73Xvae+V75nvqewx8/nv8ew98" +
  "FnwLfB98KnwmfDh8QXxAfP6BAYICggSC7IFEiCGCIoIjgi2CL4IogiuCOII7gjOCNII+gkSCSYJLgk+C" +
  "WoJfgmiCfoiFiIiI2IjfiF6JnX+ff6d/r3+wf7J/fHxJZZF8nXycfJ58onyyfLx8vXzBfMd8zHzNfMh8" +
  "xXzXfOh8boKoZr9/zn/Vf+V/4X/mf+l/7n/zf/h8d32mfa59R36bfrietJ5zjYSNlI2RjbGNZ41tjUeM" +
  "SYxKkVCRTpFPkWSRYpFhkXCRaZFvkX2RfpFykXSReZGMkYWRkJGNkZGRopGjkaqRrZGuka+RtZG0kbqR" +
  "VYx+nriN640FjlmOaY61jb+NvI26jcSN1o3XjdqN3o3Ojc+N243GjeyN9434jeON+Y37jeSNCY79jRSO" +
  "HY4fjiyOLo4jji+OOo5AjjmONY49jjGOSY5BjkKOUY5SjkqOcI52jnyOb450joWOj46UjpCOnI6ejniM" +
  "goyKjIWMmIyUjJtl1oneidqJ3InlieuJ74k+iiaLU5fplvOW75YGlwGXCJcPlw6XKpctlzCXPpeAn4Of" +
  "hZ+Gn4efiJ+Jn4qfjJ/+ngufDZ+5lryWvZbOltKWv3fglo6SrpLIkj6TapPKk4+TPpRrlH+cgpyFnIac" +
  "h5yInCN6i5yOnJCckZySnJSclZyanJucnpyfnKCcoZyinKOcpZymnKecqJypnKucrZyunLCcsZyynLOc" +
  "tJy1nLact5y6nLucvJy9nMScxZzGnMecypzLnMyczZzOnM+c0JzTnNSc1ZzXnNic2ZzcnN2c35zinHyX" +
  "hZeRl5KXlJevl6uXo5eyl7SXsZqwmreaWJ62mrqavJrBmsCaxZrCmsuazJrRmkWbQ5tHm0mbSJtNm1Gb" +
  "6JgNmS6ZVZlUmd+a4Zrmmu+a65r7mu2a+ZoImw+bE5sfmyObvZ6+njt+gp6Hnoiei56SntaTnZ6fntue" +
  "3J7dnuCe357inume557lnuqe754inyyfL585nzefPZ8+n0Sf";


class LaiManHua extends ComicSource {
    name = "来漫画（分流）";
    key = "laimanhua_split";
    version = "1.2.1";

    minAppVersion = "1.0.0";
    url = "";

    // 固定分流：搜索/详情/阅读使用 www；首页/分类使用移动域名。
    SEARCH_HOST = "https://www.laimanhua88.com";
    BROWSE_HOST = "https://m.laimanhua88.com";
    HOST = "https://www.laimanhua88.com";

    IMG_HOSTS = ["xwdf", "mhreswhm", "qwe123", "resmhpic", "reszxc"];

    // 16 个真实分类：slug 用于拼接 Referer，catid 用于 getact3.asp，page 为取证得到的总页数。
    CATS = [
        { name: "少年热血", slug: "rexue",     catid: 1,  page: 403  },
        { name: "武侠格斗", slug: "gedou",     catid: 2,  page: 103  },
        { name: "科幻魔幻", slug: "kehuan",    catid: 3,  page: 340  },
        { name: "竞技体育", slug: "jingji",    catid: 4,  page: 32   },
        { name: "爆笑喜剧", slug: "gaoxiao",   catid: 5,  page: 348  },
        { name: "侦探推理", slug: "tuili",     catid: 6,  page: 169  },
        { name: "恐怖灵异", slug: "kongbu",    catid: 7,  page: 41   },
        { name: "耽美人生", slug: "danmei",    catid: 8,  page: 94   },
        { name: "少女爱情", slug: "shaonv",    catid: 9,  page: 458  },
        { name: "恋爱生活", slug: "lianai",    catid: 10, page: 235  },
        { name: "生活漫画", slug: "shenghuo",  catid: 11, page: 56   },
        { name: "战争漫画", slug: "zhanzheng", catid: 12, page: 6    },
        { name: "故事漫画", slug: "gushi",     catid: 13, page: 17   },
        { name: "其他漫画", slug: "qita",      catid: 14, page: 1598 },
        { name: "百合女性", slug: "baihe",     catid: 15, page: 100 },
        { name: "伪娘漫画", slug: "weiniang",  catid: 16, page: 5    }
    ];

    // 两个独立下拉设置：搜索/详情/阅读与首页/分类各自选择网址，互不影响。
    settings = {
        searchDomain: {
            title: "搜索",
            type: "select",
            options: [
                { value: "https://www.laimanhua88.com", text: "www.laimanhua88.com（推荐）" },
                { value: "https://www.laimanhuaba.com", text: "www.laimanhuaba.com（镜像）" },
                { value: "https://m.laimanhua88.com", text: "m.laimanhua88.com（移动）" },
                { value: "https://m.laimanhuaba.com", text: "m.laimanhuaba.com（移动镜像）" }
            ],
            default: "https://www.laimanhua88.com"
        },
        browseDomain: {
            title: "主页",
            type: "select",
            options: [
                { value: "https://m.laimanhua88.com", text: "m.laimanhua88.com（推荐）" },
                { value: "https://m.laimanhuaba.com", text: "m.laimanhuaba.com（镜像）" },
                { value: "https://www.laimanhua88.com", text: "www.laimanhua88.com（桌面）" },
                { value: "https://www.laimanhuaba.com", text: "www.laimanhuaba.com（桌面镜像）" }
            ],
            default: "https://m.laimanhua88.com"
        }
    };

    // 初始化 GB2312 码点表（从 Base64 解码为数组）。
    _initDecodeTable() {
        if (this._gb2312Table) return;
        const raw = Convert.decodeBase64(GB2312_TABLE_B64); // ArrayBuffer
        const u8 = new Uint8Array(raw);
        const len = u8.length / 2;
        const table = new Array(len);
        for (let i = 0; i < len; i++) {
            table[i] = u8[i * 2] | (u8[i * 2 + 1] << 8);
        }
        this._gb2312Table = table;
    }

    // 将 GB2312 字节数组解码为 JavaScript 字符串。
    _gb2312Decode(bytes) {
        if (!bytes) return "";
        // bytes 可能是 ArrayBuffer / Uint8Array
        let u8;
        if (bytes instanceof Uint8Array) {
            u8 = bytes;
        } else if (bytes && bytes.byteLength !== undefined) {
            u8 = new Uint8Array(bytes);
        } else {
            return String(bytes);
        }
        this._initDecodeTable();
        const table = this._gb2312Table;
        let out = "";
        let i = 0;
        while (i < u8.length) {
            const b1 = u8[i];
            if (b1 <= 0x7F) {
                out += String.fromCharCode(b1);
                i++;
            } else if (i + 1 < u8.length && b1 >= 0xA1 && b1 <= 0xF7) {
                const b2 = u8[i + 1];
                if (b2 >= 0xA1 && b2 <= 0xFE) {
                    const idx = (b1 - 0xA1) * 94 + (b2 - 0xA1);
                    const cp = table[idx] || 0xFFFD;
                    out += String.fromCharCode(cp);
                } else {
                    out += "\uFFFD";
                }
                i += 2;
            } else {
                out += "\uFFFD";
                i++;
            }
        }
        return out;
    }

    async _settingHost(settingKey, fallback) {
        let value = "";
        try { value = await this.loadSetting(settingKey); } catch (e) {}
        const host = value && /^https?:\/\//.test(value) ? value : fallback;
        // 供同步图片加载回调复用最后一次实际业务请求的 Referer。
        this._hostCache = host;
        return host;
    }

    // 搜索、详情与阅读读取“搜索源网址”。
    async _currentHost() {
        return await this._settingHost("searchDomain", this.SEARCH_HOST);
    }

    // 首页与分类读取“主页与分类网址”。
    async _browseHost() {
        return await this._settingHost("browseDomain", this.BROWSE_HOST);
    }

    // GET 请求：取原始字节后手工 GB2312 解码。
    async _get(url, headers) {
        const h = Object.assign({ "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1" }, headers || {});
        const r = await Network.fetchBytes("GET", url, h);
        const body = (r && r.body) || "";
        if (typeof body === "string") return body;
        return this._gb2312Decode(body);
    }

    // 将 Network 响应体统一解码为 HTML；搜索端点可能由网络层自动跟随 302，也可能保留跳转响应。
    _responseText(response) {
        const body = (response && response.body) || "";
        return typeof body === "string" ? body : this._gb2312Decode(body);
    }

    async _postResponse(url, dataStr, headers) {
        const data = await Convert.encodeUtf8(dataStr);
        const h = Object.assign({ "Content-Type": "application/x-www-form-urlencoded; charset=GBK" }, headers || {});
        return await Network.fetchBytes("POST", url, h, data);
    }

    async _gbkFormComponent(value) {
        const raw = await Convert.encodeGbk(String(value || ""));
        const bytes = new Uint8Array(raw);
        const hex = "0123456789ABCDEF";
        let out = "";
        for (let i = 0; i < bytes.length; i++) {
            const b = bytes[i];
            const alpha = (b >= 65 && b <= 90) || (b >= 97 && b <= 122);
            const digit = b >= 48 && b <= 57;
            if (alpha || digit || b === 45 || b === 46 || b === 95 || b === 126) out += String.fromCharCode(b);
            else if (b === 32) out += "+";
            else out += "%" + hex.charAt((b >> 4) & 15) + hex.charAt(b & 15);
        }
        return out;
    }

    async _searchUrl(host) {
        const cacheKey = host || this.HOST;
        if (this._searchUrlCache && this._searchUrlCache[cacheKey]) return this._searchUrlCache[cacheKey];
        const home = await this._get(cacheKey + "/");
        const match = home.match(/<form\b[^>]*action=["']([^"']*search[^"']*)["'][^>]*>/i);
        let path = match && match[1] ? match[1].replace(/&amp;/gi, "&") : "";
        if (!path) path = cacheKey.indexOf("laimanhuaba") >= 0 ? "/s61/search/" : "/s81/search/";
        const url = /^https?:\/\//i.test(path) ? path : this.absoluteUrl(path, cacheKey);
        this._searchUrlCache = this._searchUrlCache || {};
        this._searchUrlCache[cacheKey] = url;
        return url;
    }

    _headerValue(headers, name) {
        if (!headers) return "";
        for (const key in headers) {
            if (String(key).toLowerCase() === String(name).toLowerCase()) {
                const value = headers[key];
                return Array.isArray(value) ? (value[0] || "") : (value || "");
            }
        }
        return "";
    }

    cleanCover(u) {
        if (!u) return "";
        u = String(u).trim();
        u = u.replace(/@!.*$/, "");
        return u;
    }

    absoluteUrl(u, host) {
        if (!u) return "";
        if (/^https?:\/\//i.test(u)) return u;
        if (String(u).startsWith("/")) return host + u;
        return u;
    }

    comicIdFromHref(href) {
        if (!href) return "";
        const m = String(href).match(/\/kanmanhua\/([^\/\s]+)\/?$/);
        return m ? m[1] : "";
    }

    parseCard(a, host) {
        const img = a.querySelector("img");
        if (!img) return null;
        const href = a.attributes.href || "";
        const id = this.comicIdFromHref(href);
        if (!id) return null;
        const h3 = a.querySelector("h3");
        const title = h3 ? h3.text.trim() : "";
        if (!title) return null;
        let sub = "";
        const p = a.querySelector("p");
        if (p && p.text) sub = p.text.trim();
        if (!sub) {
            const dds = a.querySelectorAll("dl dd");
            const parts = [];
            for (const d of dds) if (d.text) parts.push(d.text.trim());
            sub = parts.filter(Boolean).join(" | ");
        }
        const cover = this.cleanCover(img.attributes["data-src"] || img.attributes.src || "");
        return new Comic({
            id: id,
            title: title,
            subTitle: sub,
            cover: this.absoluteUrl(cover, host)
        });
    }

    parseList(html, host) {
        const doc = new HtmlDocument(html);
        const out = [];
        const seen = {};
        const as = doc.querySelectorAll("a");
        for (const a of as) {
            const img = a.querySelector("img");
            if (!img) continue;
            const href = a.attributes.href || "";
            const id = this.comicIdFromHref(href);
            if (!id || seen[id]) continue;
            const card = this.parseCard(a, host);
            if (card) { seen[id] = true; out.push(card); }
        }
                doc.dispose();
        return out;
    }

    // 搜索结果的封面与详情链接属于不同节点，必须按 #dmList 的实际卡片结构单独解析。
    parseSearchList(html, host) {
        const doc = new HtmlDocument(html || "");
        const out = [];
        const seen = {};
        const items = doc.querySelectorAll("#dmList > ul > li");
        for (const item of items) {
            const detail = item.querySelector("dt a");
            if (!detail) continue;
            const id = this.comicIdFromHref(detail.attributes.href || "");
            const title = (detail.attributes.title || detail.text || "").trim();
            if (!id || !title || seen[id]) continue;
            const img = item.querySelector("p.cover img") || item.querySelector("img");
            const cover = img ? this.cleanCover(img.attributes["data-src"] || img.attributes.src || "") : "";
            const latest = item.querySelector("a.yellow") || item.querySelector("a.red");
            const intro = item.querySelector("p.intro");
            seen[id] = true;
            out.push(new Comic({
                id: id,
                title: title,
                subTitle: latest && latest.text ? latest.text.trim() : "",
                cover: this.absoluteUrl(cover, host),
                description: intro && intro.text ? intro.text.trim() : ""
            }));
        }
        doc.dispose();
        return out;
    }

    explore = [{

        title: this.name,

        type: "multiPartPage",
        load: async (page) => {
                        const host = await this._browseHost();
            const html = await this._get(host + "/");

            const doc = new HtmlDocument(html);
            const parts = [];
            const ids = ["#main-hotupdate", "#main-lianzai", "#main-guoman",
                         "#main-caise", "#main-shangjia", "#main-reman"];
            for (const id of ids) {
                const sec = doc.querySelector(id);
                if (!sec) continue;
                const h2 = sec.querySelector("h2");
                const title = h2 ? h2.text.trim() : "推荐";
                const cards = [];
                const seen = {};
                const as = sec.querySelectorAll("a");
                for (const a of as) {
                    const img = a.querySelector("img");
                    if (!img) continue;
                    const cid = this.comicIdFromHref(a.attributes.href || "");
                    if (!cid || seen[cid]) continue;
                    const card = this.parseCard(a, host);
                    if (card) { seen[cid] = true; cards.push(card); }
                }
                if (cards.length) parts.push({ title: title, comics: cards });
            }
            doc.dispose();
            return parts;
        }
    }];

        category = {
        title: this.name,

        parts: [{
            name: "题材",
            type: "fixed",
            categories: this.CATS.map(c => c.name),
            itemType: "category",
            categoryParams: this.CATS.map(c => String(c.catid)),
            groupParam: null
        }],
        enableRankingPage: false
    };

    categoryComics = {
        optionList: [],
        load: async (category, param, options, page) => {
            page = page || 1;
                        const host = await this._browseHost();
            const cat = this.CATS.find(c => String(c.catid) === String(param)) || this.CATS[0];

            const url = host + "/getact3.asp?act=list&page=" + page +
                        "&catid=" + cat.catid + "&ajax=1&order=0";
            // 必须带 Referer，否则 getact3.asp 分页失效
            const headers = { "Referer": host + "/kanmanhua/" + cat.slug + "/" };
            const html = await this._get(url, headers);
            const comics = this.parseList(html, host);
            return { comics: comics, maxPage: cat.page };
        }
    };

    search = {
        optionList: [],
        load: async (keyword, options, page) => {
            if ((page || 1) > 1 || !String(keyword || "").trim()) return { comics: [], maxPage: 1 };
            const host = await this._currentHost();
            const key = await this._gbkFormComponent(keyword);
            const button = await this._gbkFormComponent("搜索漫画");
            const response = await this._postResponse(await this._searchUrl(host), "key=" + key + "&button=" + button, { "Referer": host + "/" });
            let html = this._responseText(response);
            const location = this._headerValue(response && response.headers, "location");
            if (!html && location) html = await this._get(this.absoluteUrl(location, host), { "Referer": host + "/" });
            return { comics: this.parseSearchList(html, host), maxPage: 1 };
        }
    };

    comic = {
        loadInfo: async (id) => {
            const host = await this._currentHost();
            const url = host + "/kanmanhua/" + id + "/";
            const html = await this._get(url);
            const doc = new HtmlDocument(html);

            const titleEl = doc.querySelector(".main-bar h1") || doc.querySelector("h1");
            const title = titleEl ? titleEl.text.trim() : (id || "");

            let cover = "";
            const og = doc.querySelector('meta[property="og:image"]');
            if (og && og.attributes.content) cover = og.attributes.content;
            if (!cover) {
                const img = doc.querySelector(".book-detail .thumb img");
                if (img) cover = img.attributes["data-src"] || img.attributes.src || "";
            }
            cover = this.absoluteUrl(this.cleanCover(cover), host);

            let author = "", category = "", status = "", updateTo = "", updateDate = "";
            const dls = doc.querySelectorAll(".book-detail dl");
            for (const dl of dls) {
                const dt = dl.querySelector("dt");
                const dd = dl.querySelector("dd");
                if (!dt || !dd) continue;
                const k = dt.text.trim();
                const v = dd.text.trim();
                if (k.indexOf("作者") >= 0) author = v;
                else if (k.indexOf("类别") >= 0) category = v;
                else if (k.indexOf("更新至") >= 0) updateTo = v;
                else if (k.indexOf("更新于") >= 0) updateDate = v;
            }
            const statusEl = doc.querySelector(".book-detail .thumb i");
            status = statusEl ? statusEl.text.trim() : "";
            const sub = [status, updateTo].filter(Boolean).join(" · ");

            const intros = doc.querySelectorAll("#bookIntro p");
            let desc = "";
            for (const p of intros) {
                const t = p.text.trim();
                if (t) desc += t + "\n";
            }
            desc = desc.trim();

            const tags = {};
            if (author) tags["作者"] = [author];
            if (category) tags["类别"] = [category];
            if (status) tags["状态"] = [status];

            // 章节 ID 是数字但不等于章节序号。若使用普通对象，JavaScript 会按数字键自动重排，
            // 造成 Venera 目录乱序；Map 会保持插入顺序。站点目录为新→旧，反向后为旧→新阅读顺序。
            const chapterEntries = [];
            const chapterSeen = {};
            const chapEls = doc.querySelectorAll("#chapterList li a");
            for (const a of chapEls) {
                const href = a.attributes.href || "";
                const m = href.match(/\/kanmanhua\/[^\/]+\/([0-9]+)\.html/);
                if (!m) continue;
                const cid = m[1];
                const ctitle = a.text.trim();
                if (cid && ctitle && !chapterSeen[cid]) {
                    chapterSeen[cid] = true;
                    chapterEntries.push([cid, ctitle]);
                }
            }
            const chapters = new Map();
            for (let i = chapterEntries.length - 1; i >= 0; i--) {
                chapters.set(chapterEntries[i][0], chapterEntries[i][1]);
            }

            doc.dispose();
            return new ComicDetails({
                title: title,
                subtitle: sub,
                cover: cover,
                description: desc,
                tags: tags,
                chapters: chapters
            });
        },

        loadEp: async (comicId, epId) => {
            if (!epId) return { images: [] };
            const host = await this._currentHost();
            const url = host + "/kanmanhua/" + comicId + "/" + epId + ".html";
            const html = await this._get(url);
            const m = html.match(/var\s+mhInfo\s*=\s*(\{[\s\S]*?\});/);
            if (!m) return { images: [] };
            let info;
            try { info = JSON.parse(m[1]); } catch (e) { return { images: [] }; }
            const path = info.path || "";
            const images = info.images || [];
            const chapterId = parseInt(info.chapterId);

            let base;
            if (info.host && String(info.host).indexOf("tgmhfc") >= 0) {
                base = String(info.host).startsWith("http") ? info.host : "https://" + info.host;
            } else if (!isNaN(chapterId) && chapterId > 542724) {
                const h = this.IMG_HOSTS[Math.floor(Math.random() * this.IMG_HOSTS.length)];
                base = "https://" + h + ".tgmhfc.uk";
            } else {
                base = "https://mhpic6.tgmhfc.uk";
            }

            const result = [];
            for (const img of images) {
                if (!img) continue;
                result.push(encodeURI(base + path + img));
            }
            return { images: result };
        },

        onImageLoad: (url, comicId, epId) => {
            const host = this._hostCache || "https://www.laimanhua88.com";
            return {
                headers: {
                    "Referer": host + "/",
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
                    "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                },
                timeout: 30000,
                retryCount: 3
            };
        },

        onThumbnailLoad: (url) => {
            const host = this._hostCache || "https://www.laimanhua88.com";
            return {
                headers: {
                    "Referer": host + "/",
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
                    "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
                },
                timeout: 30000,
                retryCount: 3
            };
        }
    };
}
