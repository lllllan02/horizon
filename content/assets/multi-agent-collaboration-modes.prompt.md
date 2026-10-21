Use case: infographic-diagram.
Asset type: 中文知识笔记的辅助解释图，PNG 位图。
Primary request: 直观看懂多 Agent 的两类协作场景：任务委派只交任务、收成果；执行中协作需要持续交换进度和发现，并区分有主管与无固定主管。画出信息如何实际流转，不做文字提纲海报。

Reference images:
- /Users/lllllan/lllllan02/horizon/.agents/skills/excalidraw-diagram/assets/diagram-style-reference.png：仅风格参考。只迁移对象造型、柔和轮廓、小面积淡彩、规整中文与视觉分量；不复制工具注册表业务、字段、代码、布局。

Style: 克制的二维技术编辑插画，白底，清晰中文，柔和圆角，中等偏细轮廓。Agent 用简化的工作窗口或带小页签的任务文档表示，内部有少量任务条目，不用机器人、脑球或纯圆圈。共享任务板有可辨认的两行任务与负责人。不要粗黑描边、大块底色、渐变、厚重阴影、装饰徽章或大标题。
Palette: 白底 #ffffff，主要文字与轮廓 #374151，次要文字 #64748b，轻边界 #a8b3c2。灰蓝 #416788 与浅蓝 #eaf0f7 表示任务或调整指令；暖橙 #b66a43 与淡橙 #fbf0e6 表示进展、成果和反馈。对象本体大多白底，淡彩只用在页签和消息票据。
Aspect: 4:3，目标画布 1280 × 960 px，紧凑布局。
Intended display: 笔记正文中约640px宽；节点标签和箭头短标签在该尺寸下仍应易读。字号适中，不以大量文字塞满图片。

Objects and relationships:
1. 上部约35%画面是“任务委派”。左侧父 Agent，右侧子 Agent。上方灰蓝箭头从父 Agent 指向子 Agent，贴近箭头写“任务”；下方暖橙箭头从子 Agent 返回父 Agent，写“成果”。两条路径分开，清楚显示发送与回传。父 Agent 内有任务清单，子 Agent 内有独立工作的文档。只需两个节点，不画持续讨论网络。
2. 下部约60%画面有共同标题“执行中协作”，下面左右两个并排区域：
  左区标题“有主管”。主管位于上方，成员 A 和成员 B 位于下方左右。成员向主管发送暖橙色“进展”，主管向成员下发灰蓝色“调整”，用分开的细箭头表示上下两个方向。成员 A 与 B 之间再有一条轻的双向虚线，标签“可直接交流”。主管清楚承担统筹，同时没有禁止成员之间直接交流。
  右区标题“无固定主管”。上方是“共享任务板”，画为带页签的任务清单而不是Agent；内部两行“任务1 · A”“任务2 · B”。下方是成员 A 和成员 B。成员与任务板之间的短双向连接表示“认领／更新”，贴近关系标注一次即可；A与B之间直接双向连线，标签“协商”。不要画任何主管Agent。共享任务板是共享记录，不是决策者。
3. 节点之间只画必要的信息流，不画 HTTP、队列、A2A、路由或交接；这些属于其他文档或次要细节。

Semantic invariants:
- 两类场景不是是否并发的互斥分类；在上部就近留一个小注“子任务可并发”，不要做页尾总结。
- 有主管可以同时有成员直接交流，虚线不能漏。
- 无固定主管可以有共享任务板，共享中心不是主管Agent；用任务清单造型而非Agent造型区分。
- 任务箭头必须从父到子，成果箭头必须从子返回父；进展从成员到主管，调整从主管到成员。
- 所有 A/B 在同一区域中保持对应，不误连到另一个区域。
- 不画“任务委派后必定转成执行中协作”的箭头，两组是对照，不是前后必经步骤。

Composition:
上部宽而紧凑，两个节点之间留足任务／成果来回箭头的位置；下部左右对照区域比例相同，标题和节点行列对齐。区域边界轻、局部有对象细节。线条优先水平或垂直，必要时只转一次直角；标签不压线、不重叠。少量边缘留白，无页尾装饰或口号，不加解释段落。

Text, verbatim:
“任务委派”“父 Agent”“子 Agent”“任务”“成果”“子任务可并发”
“执行中协作”“有主管”“无固定主管”“主管”“成员 A”“成员 B”
“进展”“调整”“可直接交流”“共享任务板”“任务1 · A”“任务2 · B”“认领／更新”“协商”
除此之外不要擅自增加文字说明，重复的成员标签按区域分别使用即可。

Validation priorities:
阅读顺序先上后下，对照任务交付与过程信息交换；两条委派箭头方向正确；有主管的反馈闭环完整且允许直接交流；无主管的共享任务板与成员角色一眼可分；中文无错字、无裁切、无重叠，640px显示时仍能看清主要标签。


Targeted revision: Preserve the generated image; fix only the bottom-left managed-coordination panel. Blue 调整 connections must start at the supervisor bottom edge and point DOWN with a single arrowhead into each member. Orange 进展 paths must start at each member and point UP then turn once into the supervisor edge with a single arrowhead at the supervisor end. Keep the member-to-member dashed direct-message connection and all other panels unchanged.
